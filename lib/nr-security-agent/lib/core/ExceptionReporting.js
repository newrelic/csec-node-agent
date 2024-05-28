/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const LinkingMetaData = require('./LinkingMetadata');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const { BasicInfo } = require('./event');
const { error } = require('../../../../../node-newrelic-fork/lib/collector/response');
const applicationInfo = require('./applicationinfo').getInstance();

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
        exceptionObject.name = exception.name;
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
        if (exception) {
            this.exception = createException(exception);
        }
        if (NRAgent) {
            this.linkingMetadata = LinkingMetaData.getLinkingMetadata();
        }
    } catch (error) {

    }

}

module.exports = {
    exceptionReporting,
    createException
};
