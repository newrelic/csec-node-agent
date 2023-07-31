/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

/* eslint-disable new-cap */

const njsAgentConstants = require('./sec-agent-constants');
const agentConfig = require('../../resources/config');
const { AGENT_DIR } = agentConfig;
const lodash = require('lodash');

let errors = [];

const ringBuffer = require('ringbufferjs');
const bufferedHC = new ringBuffer(5);
const bufferedErrors = new ringBuffer(5);
const fs = require('fs');
const util = require('util');
let HC = [];
let lastHC = {};
const logs = require('./logging');
const commonUtils = require('./commonUtils');
const logger = logs.getLogger();
const statusFile = njsAgentConstants.STATUS_LOG_FILE;

const statusTemplate = 'Snapshot timestamp: : %s\n' +
    `CSEC Agent start timestamp: ${njsAgentConstants.AGENT_START_TIME} with application uuid:${commonUtils.getUUID()}\n` +
    `SEC_HOME: ${njsAgentConstants.CSEC_HOME}\n` +
    `Agent location: ${AGENT_DIR}\n` +
    `Using CSEC Agent for Node.js, Node version:${process.version}, PID:${process.pid}\n` +
    `Process title: ${process.title}\n` +
    `Process binary: ${process.execPath}\n` +
    'Application location: %s\n' +
    `Current working directory: ${process.cwd()}\n` +
    `Agent mode: ${commonUtils.getCSECmode()}\n` +
    'Application server: %s\n' +
    'Application Framework: %s\n' +
    `Websocket connection to Prevent Web: ${commonUtils.getValidatorServiceEndpointURL()}, Status: %s\n` +
    'Instrumentation successful:\n' +
    'Tracking loaded modules in the application:\n' +
    'Policy applied successfully. Policy version is: %s\n' +
    'Started Health Check for Agent\n' +
    'Started Inbound and Outbound monitoring \n' +
    '\nProcess stats:\n%s\n' +
    '\nService stats:\n%s\n' +
    '\nLast 5 errors: \n%s\n' +
    '\nLast 5 Health Checks are:\n %s \n';

/**
 * Utility to add hc in hc buffer
 * @param {*} healthCheck
 */
function addHCtoBuffer(healthCheck) {
    try {
        bufferedHC.enq(healthCheck);
        lastHC = healthCheck;
    } catch (error) {
        logger.debug(error);
    }
}

/**
 * Utility to add error object in error buffer
 * @param {*} error
 */
function addErrortoBuffer(error) {
    try {
        let errorObj = {
            'error': error.stack
        }
        bufferedErrors.enq(errorObj);
    } catch (error) {
        logger.debug(error);
    }
}

/**
 * utility to format status template with dynamic values
 */
function getFormattedData() {
    const Agent = require('./agent').Agent.getAgent();
    const appInfo = Agent.applicationInfo;
    const deployedApplications = appInfo && appInfo.serverInfo && appInfo.serverInfo.deployedApplications;
    const appLoc = deployedApplications[0].deployedPath;
    const formattedSnapshot = util.format(statusTemplate, new Date().toString(), appLoc, appInfo.serverInfo.name, njsAgentConstants.FRAMEWORK,commonUtils.getWSHealthStatus(), appInfo.policyVersion, getKeyValPairs(lastHC.stats), getKeyValPairs(lastHC.serviceStatus), JSON.stringify(getBufferedErrors()), JSON.stringify(getBufferedHC()));
    return formattedSnapshot;
}

/**
 * utility to write snapshot in snapshot file
 */
function writeSnapshot() {
    const snapshot = getFormattedData();
    commonUtils.removeOlderSnapshots();
    fs.writeFile(statusFile, snapshot, { mode: 0o777 }, function (err) {
        if (err) {
            logger.debug(err.message);
        } else {
            logger.info('Snapshot updated to file: %s', statusFile);
            fs.chmod(statusFile, 0o777, (err) => {
                if (err) {
                    addErrortoBuffer(err);
                }
            });
        }
    });
}
/**
 * return buffered error instance.
 */
function getRingBufferedErrors() {
    return bufferedErrors;
}

/**
 * return buffered HC list without null, undefined
 */
function getBufferedHC() {
    try {
        HC = lodash.compact(bufferedHC._elements);
    } catch (error) {
        logger.debug(error);
    }

    return HC;
}
/**
 * returns buffered error list without null, undefined
 */
function getBufferedErrors() {
    try {
        errors = lodash.compact(bufferedErrors._elements);
    } catch (error) {
        logger.debug(error);
    }
    return errors;
}

/**
 * Utility to get key val pairs from json object
 * @param {*} jsonObject
 */
function getKeyValPairs(jsonObject) {
    let statStr = njsAgentConstants.EMPTY_STR;
    for (const key in jsonObject) {
        statStr = statStr + key + ': ' + jsonObject[key] + '\n';
    }
    return statStr;
}

module.exports = {
    statusTemplate,
    addHCtoBuffer,
    getFormattedData,
    writeSnapshot,
    addErrortoBuffer,
    getRingBufferedErrors,
    getBufferedHC,
    getBufferedErrors
};
