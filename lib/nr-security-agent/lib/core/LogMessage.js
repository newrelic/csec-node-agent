/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

const LinkingMetaData = require('./LinkingMetadata');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();

/**
 * constructor function to create LogMessageException object
 * @param {*} message
 * @param {*} cause
 * @param {*} stacktrace
 */
function logMessageException (exception) {
    this.message = exception.message;
    this.cause = exception.cause ? exception.cause : '';
    this.stacktrace = exception.stack;
}

/**
  * constructor function to create logMessage object;
  * @param {*} timestamp
  * @param {*} level
  * @param {*} message
  * @param {*} caller
  * @param {*} exception
  * @param {*} linkingMetadata
  */
function logMessage (level, message, caller, exception) {
    this.timestamp = Date.now();
    this.level = level;
    this.message = message;
    this.caller = caller;
    if (exception) {
        this.exception = logMessageException(exception);
    }
    if (NRAgent) {
        this.linkingMetadata = LinkingMetaData.getLinkingMetadata();
    }
}

module.exports = {
    logMessage,
    logMessageException
};
