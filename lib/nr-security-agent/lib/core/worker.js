/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

// Access the workerData by requiring it.
const { parentPort, workerData } = require('worker_threads');
// we need to initialize logger first hand
const logs = require('./logging');
const { applicationInfo } = workerData;
const logger = logs.getLogger(applicationInfo.applicationUUID);

const { SecWebSocket, WSCallbacks, releaseWebSocket } = require('./connections/websocket');
const {
    SetDefaultLogLevelHandler,
    FuzzRequestHandler,
    setLogger: setResponseHandlerLogger
} = require('./connections/websocket/response');
const { SERVER_COMMAND } = require('./sec-agent-constants');
const { WorkerMessage, WORKER_STATUS } = require('./worker-entities');
const { Agent } = require('./agent');
const statusUtils = require('./statusUtils');
const commonUtils = require('./commonUtils');


const MESSAGE = 'message';

const flushInitiatedMsg = new WorkerMessage(WorkerMessage.TYPE.FLUSH, { status: 'initiated' });
const flushFinishedMsg = new WorkerMessage(WorkerMessage.TYPE.FLUSH, { status: 'flushed' });

let connection;
// we would want to provide a custome on data
// handler as the some control comands might
// need change in current thread, and main thread
// as well.
const webSocketCallbacks = new WSCallbacks(null, function (data) {
    try {
        const json = JSON.parse(data);
        if (!json.controlCommand) {
            return;
        }
        // we need some updates in worker threads also
        switch (json.controlCommand) {
        case SERVER_COMMAND.SET_DEFAULT_LOG_LEVEL:
            SetDefaultLogLevelHandler(json);
            break;
        case SERVER_COMMAND.FUZZ_REQUEST:
            FuzzRequestHandler.handler(json);
            // we would not want this to be duplicated
            // in main thread, so we would return from here
            return;
        default:
        }

        // send the message to parent in non-blocking mode
        setImmediate(function () {
            parentPort.postMessage(new WorkerMessage(WorkerMessage.TYPE.MESSAGE, json));
        });
    } catch (err) {

    }
}, null);

/**
 * This would initiate the worker and bootstrap
 * all the necessary configurations.
 */
function initWorker () {
    Agent.init(applicationInfo, logger, null, null);
    setResponseHandlerLogger(logger);
    logger.info('Creating websocket connection in worker thread');
    const validatorService = commonUtils.getValidatorServiceEndpointURL();
    connection = new SecWebSocket(validatorService, webSocketCallbacks, logger);
    Agent.getAgent().setClient(connection);
    // Main thread will pass the data you need
    // through this event listener.
    parentPort.on(MESSAGE, handleMessage);
    // we would set the worker as initialized here
    process.env.WS_WORKER_STATUS = WORKER_STATUS.RUNNING;
}

/**
 * Makes the event queue flush
 * when the websocket is initialized in
 * worker, using the connection instance.
 * This also triggers events to main to mark
 * the flushing initiated or complete
 */
async function flushEventQueueFromWorker () {
    parentPort.postMessage(flushInitiatedMsg);
    await connection.flushEventQueue();
    parentPort.postMessage(flushFinishedMsg);
}

/**
 * This handles any messages received from main
 * if websocket worker is initialized
 *
 * @param {JSON} msg
 */
function handleMessage (msg) {
    const workerMsg = WorkerMessage.parseFromObject(msg);
    if (logger.level && (logger.level.levelStr !== process.env.loglevel)) {
        logger.level = process.env.loglevel;
    }
    switch (workerMsg.getType()) {
    case WorkerMessage.TYPE.MESSAGE: {
        connection.dispatch(workerMsg.getPayload());
        releaseWebSocket();
        break;
    }
    case WorkerMessage.TYPE.FLUSH: {
        flushEventQueueFromWorker();
        break;
    }
    case WorkerMessage.TYPE.UPDATE_APPLICATION_INFO:
        Agent.getAgent().setApplicationInfo(workerMsg.getPayload());
        break;
    case WorkerMessage.TYPE.RECONNECT: {
        connection.reconnect();
        break;
    }
    case WorkerMessage.TYPE.OBEY_RECONNECT: {
        connection.obeyReconnect();
        break;
    }
    default:
    }
}

setInterval(() => {
    try {
        const buffErrors = statusUtils.getRingBufferedErrors();
        while (!buffErrors.isEmpty()) {
            const err = buffErrors.deq();
            parentPort.postMessage(new WorkerMessage(WorkerMessage.TYPE.ERROR, err));
        }
    } catch (error) {
    }
}, 240000);

/**
 * This would initiate the worker when the
 * module is loaded.
 */
(() => {
    initWorker();
})();
