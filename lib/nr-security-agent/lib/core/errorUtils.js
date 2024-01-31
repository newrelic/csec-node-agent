/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const LinkingMetaData = require('./LinkingMetadata');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const { BasicInfo } = require('./event');
const { EMPTY_STR } = require('./sec-agent-constants');
const applicationInfo = require('./applicationinfo').getInstance();
const logs = require('./logging');
const logger = logs.getLogger();

/**
 * constructor function to create exception object
 * @param {*} message
 * @param {*} cause
 * @param {*} stacktrace
 */
function createErrorObject(error) {
    let errorObject = {};
    try {
        let errorMessage = error.message ? error.message : EMPTY_STR;
        let errorCode = error.code ? error.code : EMPTY_STR;
        errorObject.message = errorCode + " : " + errorMessage;
        errorObject.cause = null;
        if (error.stack) {
            let stacktraceInList = error.stack.split('\n');
            stacktraceInList = stacktraceInList.slice(1);
            errorObject.stacktrace = stacktraceInList;
        }

    } catch (error) {

    }

    return errorObject;
}

/**
  * constructor function to create errorEvent object;
  * @param {*} error
  */
function generateErrorEvent(error, requestData) {
    try {
        BasicInfo.call(this);
        this.jsonVersion = applicationInfo.jsonVersion;
        this.pid = applicationInfo.pid ? applicationInfo.pid : null;
        this.jsonName = 'Exception';
        this.applicationUUID = applicationInfo.applicationUUID;
        this.groupName = applicationInfo.groupName;
        this.policyVersion = applicationInfo.policyVersion;
        this.timestamp = Date.now();
        this.parentId = requestData.headers['nr-csec-parent-id'];
        this.httpRequest = requestData;
       
        if (error) {
            this.exception = createErrorObject(error);
        }
        if (NRAgent) {
            this.linkingMetadata = LinkingMetaData.getLinkingMetadata();
        }
        logger.debug("generated error:", JSON.stringify(this));
    } catch (error) {
    
    }

}

process.on('uncaughtExceptionMonitor', (err, origin) => {
    logger.debug("Uncaught Exception is:", origin, err);
  });

module.exports = {
    generateErrorEvent
};
