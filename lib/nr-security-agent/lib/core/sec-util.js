/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { SecEvent } = require('./event');
const logs = require('./logging');
const { Agent } = require('./agent');
const shaUtil = require('./sha-size-util');
const { LOG_MESSAGES, NR_CSEC_FUZZ_REQUEST_ID, COLON, VULNERABLE, EXITEVENT, EMPTY_STR } = require('./sec-agent-constants');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();

const statusUtils = require('./statusUtils');

let firstEvent = false;
let firstEventSent = false;

const events = require('events');
const eventEmitter = undefined;

let logger = logs.getLogger();
const initLogger = logs.getInitLogger();

const NODE_SER = 'node-serialize/lib/serialize.js';

function getSecEventEmitter() {
    if (eventEmitter) {
        return eventEmitter;
    } else {
        return new events.EventEmitter();
    }
}


/**
 * Sets the logger instance.
 *
 * @param {*} loggerInstance
 */
const setLogger = loggerInstance => {
    logger = loggerInstance;
};


function promisify(thisArg, fn) {
    return (...args) => new Promise((resolve, reject) => {
        args.push((err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
        fn.apply(thisArg, args);
    });
}

const sleep = (timeout) => new Promise((resolve) => {
    setTimeout(resolve, timeout);
});


function generateSecEvent(securityMetadata) {
    const traceObject = securityMetadata.traceObject;
    const request = securityMetadata.request;

    try {
        let stakTrace = traceObject.stacktrace;
        let uri = EMPTY_STR;
        if (request.uri) {
            uri += request.uri;
        }

        let apiId = shaUtil.getSHA256ForData(traceObject.stacktrace.join('|') + uri);
        const agentModule = Agent.getAgent();
        const metaData = {};
        if (traceObject.sourceDetails && traceObject.sourceDetails.evalObj) {
            metaData.triggerViaRCI = true;
            metaData.rciMethodsCalls = traceObject.sourceDetails.evalObj.invokedCalls;
            metaData.rciDetail = traceObject.sourceDetails.evalObj;
            if (traceObject.sourceDetails.evalObj) {
                const evalFile = traceObject.sourceDetails.evalObj.fileName;
                if (evalFile && evalFile.includes(NODE_SER)) {
                    metaData.triggerViaDeserialisation = true;
                }
            }
        }
        const isClientDetectedFromXFF = false;

        if (!firstEvent) {
            initLogger.info(LOG_MESSAGES.FIRST_EVENT_INTERCEPTED, securityMetadata.eventCategory, JSON.stringify(request));
        }
        const isAPIBlocked = false;

        const event = new SecEvent(traceObject.sourceDetails.fileName, traceObject.sourceDetails.funcName, traceObject.sourceDetails.lineNumber, securityMetadata.interceptedArgs, securityMetadata.executionId, agentModule.applicationInfo, securityMetadata.request, securityMetadata.eventType, traceObject.sourceDetails.source, securityMetadata.eventCategory, metaData, stakTrace, apiId, isAPIBlocked);
        event.metaData.isClientDetectedFromXFF = isClientDetectedFromXFF;

        if (!firstEvent) {
            initLogger.info(LOG_MESSAGES.FIRST_EVENT_PROCESSED, JSON.stringify(event));
            firstEvent = true;
        }

        return event;
    } catch (e) {
        statusUtils.addErrortoBuffer(e);
        logger.error("Error in generating event:", e);
    }

}

/**
 *
 * @param {current context} context
 * @param {Sec agent module} agentModule
 * Utility to generate exit events.
 */
function generateExitEvent(secEvent) {
    if (secEvent && secEvent.httpRequest && secEvent.httpRequest.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
        try {
            const fuzzHeader = secEvent.httpRequest.headers[NR_CSEC_FUZZ_REQUEST_ID];
            const apiId = fuzzHeader.split(COLON)[0].trim();
            if (fuzzHeader.includes(VULNERABLE) && apiId === secEvent.apiId) {
                const exitEvent = {};
                exitEvent.jsonName = EXITEVENT;
                exitEvent.applicationUUID = secEvent.applicationUUID;
                exitEvent.groupName = secEvent.groupName;
                exitEvent.nodeId = secEvent.nodeId;
                exitEvent.jsonVersion = secEvent.jsonVersion;
                exitEvent.buildNumber = secEvent.buildNumber;
                exitEvent.policyVersion = secEvent.policyVersion;
                exitEvent.executionId = secEvent.id;
                exitEvent.caseType = secEvent.caseType;
                exitEvent.k2RequestIdentifier = secEvent.httpRequest.headers[NR_CSEC_FUZZ_REQUEST_ID];
                sendEvent(exitEvent);
            }
        } catch (error) {
            logger.error('Error in generating exit event', error);
        }
    }
}


function sendEvent(secEvent) {
    const agentModule = Agent.getAgent();
    if (agentModule.status.getStatus() === 'active' && NRAgent.config.security.enabled) {
        agentModule.client.dispatcher(secEvent);
        if (!firstEventSent) {
            initLogger.info(LOG_MESSAGES.FIRST_EVENT_SENT, JSON.stringify(secEvent));
            firstEventSent = true;
        }
    }

}

module.exports = {
    setLogger,
    getSecEventEmitter: getSecEventEmitter,
    promisify,
    sleep,
    generateSecEvent,
    sendEvent,
    generateExitEvent
};
