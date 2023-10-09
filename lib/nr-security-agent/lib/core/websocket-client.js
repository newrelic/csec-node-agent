/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict';
const LOG_MESSAGES = require('./sec-agent-constants').LOG_MESSAGES;

const { Agent } = require('./agent');
const AgentStatus = require('./agent-status');
const hc = require('./health-check');
const applicationInfo = require('./applicationinfo').getInstance();
const logger = require('./logging').getLogger(applicationInfo.applicationUUID);
const initLogger = require('./logging').getInitLogger();
const commonUtils = require('./commonUtils');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const {
    SecWebSocket,
    setWebSocketConn,
    ResponseHandler: {
        setLogger: setResponseHandlerLogger
    }
} = require('./connections/websocket');
const { HC_INTERVAL_MS } = require('../../resources/config');
const { LOG_DIR, EXITEVENT, JSON_NAME } = require('./sec-agent-constants');
const statusUtils = require('./statusUtils');
const njsAgentConstants = require('./sec-agent-constants');

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

    initializeInMainThread();

    // we'll dispatch the application info if it is updated
    Agent.eventEmitter.on(Agent.EVENTS.APPLICATION_INFO_UPDATE_EVENT, (applicationInfo) => {
        if (!NRAgent || (NRAgent && applicationInfo.entityGuid)) {
            dispatcher(applicationInfo);
        }
    });
    Agent.eventEmitter.on(Agent.EVENTS.RECONNECT_WS_EVENT, () => {
        setWebSocketConn();
        wsInstance.reconnect();
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
    } else {
        return wsInstance;
    }
}

/**
 * Sends Agent HelthCheck to Validator.
 */
const sendHC = async function () {
    if (AgentStatus.getInstance().getStatus() != AgentStatus.CSECAgentStatus.codes.DISABLED && (NRAgent ? (NRAgent.config.security.enabled && NRAgent.canCollectData()) : true)) {
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
        json.serviceStatus.websocket = commonUtils.getWSHealthStatus();
        json.serviceStatus.logWriter = await commonUtils.isLogAccessible(`${LOG_DIR}node-security-collector.log`);
        json.serviceStatus.initLogWriter = await commonUtils.isLogAccessible(`${LOG_DIR}node-security-collector-init.log`);
        json.serviceStatus.statusLogWriter = await commonUtils.isLogAccessible(njsAgentConstants.STATUS_LOG_FILE);
        json.serviceStatus.agentActiveStat = commonUtils.isAgentActiveState();
        json.serviceStatus.iastRestClient = commonUtils.iastRestClientStatus();

        json.exitEventSentCount = json.exitEventStats.sent;
        json.eventRejectionCount = json.raspEventStats.rejected + json.iastEventStats.rejected;
        json.eventProcessingErrorCount = json.raspEventStats.errorCount + json.iastEventStats.errorCount;
        json.eventSendRejectionCount = json.eventRejectionCount;
        json.eventSendErrorCount = json.eventProcessingErrorCount;

        hc.getInstance().resetDropCount();
        hc.getInstance().resetProcessedCount();
        hc.getInstance().resetEventSentCount();
        hc.getInstance().resetHttpRequestCount();
        hc.getInstance().resetEventStats();

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
    if (eventType === JSON_NAME.EVENT || eventType === EXITEVENT) {
        hc.getInstance().registerEventProcessed();
    }

    dispatcher(eventJson);

    if (eventType === JSON_NAME.EVENT || eventType === EXITEVENT) {
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


function obeyReconnect() {
    wsInstance.obeyReconnect();
}

module.exports = {
    initialize,
    write: sendEvent,
    dispatcher: getDispatcherAndSendEvent,
    obeyReconnect
};
