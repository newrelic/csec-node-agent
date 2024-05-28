/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const LinkingMetaData = require('./LinkingMetadata');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const { BasicInfo } = require('./event');
const applicationInfo = require('./applicationinfo').getInstance();
const exceptionsMap = new Map();
const logs = require('./logging');
const logger = logs.getLogger();
const exceptionReportingInterval = 30000;

/**
 * constructor function to create createException object
 * @param {*} message
 * @param {*} cause
 * @param {*} stacktrace
 */
function createException(exception) {
    let exceptionObject = {};
    try {
        exceptionObject.message = exception.message ? exception.message : '';
        exceptionObject.cause = null;
        exceptionObject.type = exception.name;
        if (exception.stack) {
            let stacktraceInList = exception.stack.split('\n');
            stacktraceInList = stacktraceInList.slice(1);
            exceptionObject.stacktrace = stacktraceInList;
        }

    } catch (error) {
    }

    return exceptionObject;
}

/**
  * constructor function to create exceptionReporting object;
  * @param {*} timestamp
  * @param {*} level
  * @param {*} message
  * @param {*} caller
  * @param {*} exception
  * @param {*} linkingMetadata
  */
function exceptionReporting(exception, request) {
    try {
        BasicInfo.call(this);
        this.jsonVersion = applicationInfo.jsonVersion;
        this.pid = applicationInfo.pid ? applicationInfo.pid : null;
        this.jsonName = 'application-runtime-error';
        this.applicationUUID = applicationInfo.applicationUUID;
        this.policyVersion = applicationInfo.policyVersion;
        this.timestamp = Date.now();
        this.httpRequest = request;
        this.counter = 1;
        if (exception) {
            this.exception = createException(exception);
        }
        if (NRAgent) {
            this.linkingMetadata = LinkingMetaData.getLinkingMetadata();
        }
    } catch (error) {

    }

}

function generateExceptionReportingEvent(error, request) {
    try {
        const exception = new exceptionReporting(error, request);
    let key = exception.exception.type + exception.exception.stacktrace[0];
    if (!exceptionsMap.has(key)) {
        exceptionsMap.set(key, exception);
    }
    else {
        exception.counter = exception.counter + 1;
        exceptionsMap.set(key, exception);
    }
    } catch (err) {
        logger.debug("Error while generating application-runtime-error:", err);
    }
    
}

function startExceptionSendingSchedular(){
    try {
        setInterval(() => {
            const values = Array.from(exceptionsMap.values());
            for(let i=0;i< values.length;i++){
                API.sendEvent(values[i]);
                logger.debug("Reporing error:", JSON.stringify(values[i]));
            }
            exceptionsMap.clear();
        }, exceptionReportingInterval);
    } catch (error) {
        logger.info("Error in exception reporting schedular");
    }   
}

startExceptionSendingSchedular();

module.exports = {
    exceptionReporting,
    createException,
    generateExceptionReportingEvent,
    startExceptionSendingSchedular
};
