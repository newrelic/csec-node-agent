/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict';

const { SecEvent } = require('./event');
const logs = require('./logging');
const { Agent } = require('./agent');
const shaUtil = require('./sha-size-util');
const { LOG_MESSAGES, NR_CSEC_FUZZ_REQUEST_ID, COLON, VULNERABLE, EXITEVENT, EMPTY_STR, RASP } = require('./sec-agent-constants');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const HC = require('./health-check');

const statusUtils = require('./statusUtils');

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

    if(request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]){
        HC.getInstance().iastEventStats.processed++;
    }
    else{
        HC.getInstance().raspEventStats.processed++;
    }
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
        const isAPIBlocked = false;
        const event = new SecEvent(traceObject.sourceDetails.fileName, traceObject.sourceDetails.funcName, traceObject.sourceDetails.lineNumber, securityMetadata.interceptedArgs, securityMetadata.executionId, agentModule.applicationInfo, securityMetadata.request, securityMetadata.eventType, traceObject.sourceDetails.source, securityMetadata.eventCategory, metaData, stakTrace, apiId, isAPIBlocked);
        event.metaData.isClientDetectedFromXFF = isClientDetectedFromXFF;
        return event;
    } catch (e) {
        statusUtils.addErrortoBuffer(e);
        logger.error("Error in generating event:", e);
       
        if(request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]){
            HC.getInstance().iastEventStats.errorCount++;
        }
        else{
            HC.getInstance().raspEventStats.errorCount++;
        }
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
                HC.getInstance().exitEventStats.processed++;
                sendEvent(exitEvent);
            }
        } catch (error) {
            logger.error('Error in generating exit event', error);
            HC.getInstance().exitEventStats.errorCount++;
        }
    }
}


function sendEvent(secEvent) {
    const agentModule = Agent.getAgent();
    if (agentModule.status.getStatus() != 'connecting' && NRAgent.config.security.enabled) {
        agentModule.client.dispatcher(secEvent);
        if (!firstEventSent && agentModule.status.getStatus() === 'active') {
            initLogger.info("[STEP-8] => First event sent for validation. Security Agent started successfully", JSON.stringify(secEvent));
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
