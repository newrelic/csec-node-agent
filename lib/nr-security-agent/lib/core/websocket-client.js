/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict';
const path = require('path');
const RingBuffer = require('ringbufferjs');
const LOG_MESSAGES = require('./sec-agent-constants').LOG_MESSAGES;

const { Agent } = require('./agent');
const AgentStatus = require('./agent-status');
const hc = require('./health-check');
const applicationInfo = require('./applicationinfo').getInstance();
const logger = require('./logging').getLogger(applicationInfo.applicationUUID);
const initLogger = require('./logging').getInitLogger();
const { WorkerMessage, WORKER_STATUS } = require('./worker-entities');
const commonUtils = require('./commonUtils');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const {
    SecWebSocket,
    setWebSocketConn,
    aquireWebSocket,
    ResponseHandler: {
        handle: handleServerResponse,
        setLogger: setResponseHandlerLogger
    }
} = require('./connections/websocket');
const { HC_INTERVAL_MS } = require('../../resources/config');
const { IS_LAMBDA_ENV, LAMBDA_ENABLE_RESPONSE_BLOCKING, LOG_DIR } = require('./sec-agent-constants');
const statusUtils = require('./statusUtils');
const njsAgentConstants = require('./sec-agent-constants');

const MAX_BUSY_WAIT_TIME = 5000; // ms
const workerSupported = commonUtils.hasWorker();;
const filePath = path.join(__dirname, 'worker.js');
const localQueue = new RingBuffer(1000);

let busy = false;
let wsWorker;
let wsInstance;
let dispatcher;

const DEFAULT_EVENT_SEND_CB = err => {
    if (err) {
        hc.getInstance().registerEventDrop();
        logger.debug(err);
    }
};

/**
 * Initializes the Websocket connection to Validator.
 */
const initialize = function () {
    // we would want that the websocket be
    // initialized once only. All ws reconnection
    // and recovery mechanisms must be handled by
    // the SecWebSocket internally.
    if (dispatcher) {
        logger.warn("Websocket must be initialized only once");
        obeyReconnect();
        return;
    }

    setResponseHandlerLogger(logger);

    if (workerSupported) {
        initiateInWorkerThread();
    } else {
        initializeInMainThread();
    }
    // we'll dispatch the application info if it is updated
    Agent.eventEmitter.on(Agent.EVENTS.APPLICATION_INFO_UPDATE_EVENT, (applicationInfo) => {
        if (!NRAgent || (NRAgent && applicationInfo.entityGuid)) {
            dispatcher(applicationInfo);
        }
    });
    Agent.eventEmitter.on(Agent.EVENTS.RECONNECT_WS_EVENT, () => {
        setWebSocketConn();
        if (workerSupported) {
            const reConnectMsg = new WorkerMessage(WorkerMessage.TYPE.RECONNECT, {});
            wsWorker.postMessage(reConnectMsg);
        } else {
            wsInstance.reconnect();
        }
    });

    setTimeout(() => {
        setInterval(sendHC, HC_INTERVAL_MS);
        sendHC();
    }, 30000);

    setInterval(commonUtils.logRollOver, 30000);
    initLogger.info("[STEP-5] => Security Agent components started");
};

/**
 * This initiates the ws in main thread
 */
function initializeInMainThread() {
    logger.info(LOG_MESSAGES.NODE_VERSION_MSG, process.version);
    if (!wsInstance) {
        const validatorService = commonUtils.getValidatorServiceEndpointURL();
        wsInstance = new SecWebSocket(validatorService, {}, logger);
        dispatcher = function dispatcher(message) {
            wsInstance.dispatch(message);
        };

        // Setup the event listeners
        wsInstance.event.on(SecWebSocket.Events.BUSY, function () {
            busy = true;
        });
        wsInstance.event.on(SecWebSocket.Events.INACTIVE, function () {
            busy = false;
        });
    } else {
        return wsInstance;
    }
}

/**
 * This initiates the ws in worker thread
 */
function initiateInWorkerThread() {
    if (workerSupported) {
        process.env.WS_WORKER_STATUS = WORKER_STATUS.INITIALIZING;
        try {
            setWebSocketConn();
            const { Worker, SHARE_ENV } = require('worker_threads');
            wsWorker = new Worker(filePath, {
                workerData: {
                    applicationInfo
                },
                env: SHARE_ENV
            });
            wsWorker.on('message', handleWorkerMessage);
            wsWorker.on('error', (err) => {
                logger.error('Exception in web socket worker:', err.message);
                wsWorker = new Worker(filePath, {
                    workerData: {
                        applicationInfo
                    }, env: SHARE_ENV
                });
            });
            dispatcher = function dispatcher(message) {
                if (process.env.WS_WORKER_STATUS !== WORKER_STATUS.RUNNING) {
                    localQueue.enq(message);
                    return;
                }
                // websocket is aquired here and then
                // released in worker thread when the
                // handoff to websocket is confirmed
                aquireWebSocket();
                const msg = new WorkerMessage(WorkerMessage.TYPE.MESSAGE, message);
                wsWorker.postMessage(msg);
            };
            logger.info(LOG_MESSAGES.NODE_VERSION_MSG_WORKER, process.version);
        } catch (error) {
            logger.debug('error is:', error);
        }
    }
}

/**
 * This handles any messages received from worker
 * if websocket worker is initialized
 *
 * @param {JSON} json
 */
function handleWorkerMessage(json) {
    const msg = WorkerMessage.parseFromObject(json);
    switch (msg.type) {
        case WorkerMessage.TYPE.MESSAGE: {
            logger.debug(LOG_MESSAGES.MSG_FROM_WORKKER, msg.getPayload());
            handleServerResponse(msg.getPayload());
            break;
        }
        case WorkerMessage.TYPE.FLUSH: {
            const { status } = msg.getPayload();
            if (status === 'flushed') {
                logger.debug('Message from worker thread: Flush Completed');
            }
            break;
        }
        case WorkerMessage.TYPE.IC_READY_FOR_EVENTS: {
            break;
        }
        case WorkerMessage.TYPE.BUSY: {
            busy = true;
            break;
        }
        case WorkerMessage.TYPE.INACTIVE: {
            busy = false;
            break;
        }
        case WorkerMessage.TYPE.ERROR: {
            statusUtils.addErrortoBuffer(msg.getPayload().stack);
            break;
        }
        default:
    }
}

/**
 * Sends Agent HelthCheck to Validator.
 */
const sendHC = async function () {
    if (AgentStatus.getInstance().getStatus() === AgentStatus.CSECAgentStatus.codes.ACTIVE && (NRAgent ? (NRAgent.config.security.enabled && NRAgent.canCollectData()) : true)) {
        let json = hc.getInstance().get();
        json = JSON.parse(json);
        json.policyVersion = applicationInfo.policyVersion;
        json.entityGuid = applicationInfo.entityGuid;
        try {
            json.stats = await commonUtils.getHCStats();
        } catch (error) {
            logger.error(error);
        }

        json.serviceStatus = {};
        json.serviceStatus.websocket = process.env.WS_HEALTH;
        json.serviceStatus.logWriter = await commonUtils.isLogAccessible(`${LOG_DIR}node-security-collector.log`);
        json.serviceStatus.initLogWriter = await commonUtils.isLogAccessible(`${LOG_DIR}node-security-collector-init.log`);
        json.serviceStatus.statusLogWriter = await commonUtils.isLogAccessible(njsAgentConstants.STATUS_LOG_FILE);
        json.serviceStatus.agentActiveStat = commonUtils.isAgentActiveState();
        json.serviceStatus.iastRestClient = commonUtils.iastRestClientStatus();

        hc.getInstance().resetDropCount();
        hc.getInstance().resetProcessedCount();
        hc.getInstance().resetEventSentCount();
        hc.getInstance().resetHttpRequestCount();

        logger.info('Health Check Status:', JSON.stringify(json));
        statusUtils.addHCtoBuffer(json);
        statusUtils.writeSnapshot();
        getDispatcherAndSendEvent(json);
    }
};

/**
 * Will send event asyncronously.
 *
 * @param {JSON} eventJson
 */
function getDispatcherAndSendEvent(eventJson) {
    const eventType = eventJson.jsonName;
    if (eventType === 'Event') {
        hc.getInstance().registerEventProcessed();
    }

    dispatcher(eventJson);

    if (eventType === 'Event') {
        hc.getInstance().registerEventSent();
    }

}

/**
 * Sends passed Event to Validator.
 *
 * @param {Event} event
 * @param {Function} callback (optional)
 */
function sendEvent(event, callback = DEFAULT_EVENT_SEND_CB) {
    dispatcher(event);
    callback();
};

/**
 * Flushes local queue to the worker
 */
function flushLocalQueue() {
    if (!workerSupported) return;

    while (!localQueue.isEmpty()) {
        dispatcher(localQueue.deq());
    }
}

/**
 * Waits for websocket to get idel before
 * exiting the lambda function
 * @param {Number} startTime
 */
function busyWaitOnWorkerThread(startTime = Date.now()) {
    if (!workerSupported) return;

    const workerInitiatedOnWait = process.env.WS_WORKER_STATUS === WORKER_STATUS.RUNNING;
    const enableWait = !IS_LAMBDA_ENV || process.env[LAMBDA_ENABLE_RESPONSE_BLOCKING] === 'true';

    let flushed = false;
    let wait = (
        process.env.CSEC_WS_STATE === SecWebSocket.States.CONNECTING ||
        (
            enableWait &&
            process.env.CSEC_WS_STATE === SecWebSocket.States.BUSY
        )
    ) && (startTime + MAX_BUSY_WAIT_TIME > Date.now());
    while (wait) {
        wait = (
            process.env.CSEC_WS_STATE === SecWebSocket.States.CONNECTING ||
            (
                enableWait &&
                process.env.CSEC_WS_STATE === SecWebSocket.States.BUSY
            )
        ) && (startTime + MAX_BUSY_WAIT_TIME > Date.now());

        if (!flushed && !workerInitiatedOnWait && process.env.WS_WORKER_STATUS === WORKER_STATUS.RUNNING) {
            flushed = true;
            flushLocalQueue();
        }
    }
}

function obeyReconnect() {
    if (workerSupported) {
        const reConnectMsg = new WorkerMessage(WorkerMessage.TYPE.OBEY_RECONNECT, {});
        wsWorker.postMessage(reConnectMsg);
    } else {
        wsInstance.obeyReconnect();
    }
}

module.exports = {
    initialize,
    write: sendEvent,
    dispatcher: getDispatcherAndSendEvent,
    flushLocalQueue,
    busyWaitOnWorkerThread,
    obeyReconnect
};