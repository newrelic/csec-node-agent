
/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
let policy;
const logs = require('./logging');
const logger = logs.getLogger();
const initLogger = logs.getInitLogger();
const LOG_MESSAGES = require('./sec-agent-constants').LOG_MESSAGES;
const default_policy = {"version":"DEFAULT","logLevel":"INFO","policyPull":true,"policyPullInterval":60,"vulnerabilityScan":{"enabled":false,"cveScan":{"enabled":false,"enableEnvScan":false,"cveDefinitionUpdateInterval":360},"iastScan":{"enabled":false,"probing":{"interval":1,"batchSize":17}}},"protectionMode":{"enabled":false,"ipBlocking":{"enabled":false,"attackerIpBlocking":false,"ipDetectViaXFF":false,"timeout":2},"apiBlocking":{"enabled":false,"protectAllApis":false,"protectKnownVulnerableApis":false,"protectAttackedApis":false}},"sendCompleteStackTrace":false,"enableHTTPRequestPrinting":false,"policyParameters":{"allowedIps":[],"blockedIps":[],"allowedApis":[],"blockedApis":[],"allowedRequests":[]}}

function Policy() {
    this.data = {};
}
Policy.prototype.constructor = Policy;

/**
 * Returns the current instanceof Policy,
 * creates one if not already created.
 *
 * @returns {Policy} instance
 */
function getInstance() {
    if (!policy) {
        policy = new Policy();
    }
    return policy;
}


// sets up policy data to use globally.
function setPolicyData(data) {
    policy = getInstance();
    if (policy.data.version !== data.version) {
        policy.data = data;
        appInfoVersionUpdate(policy, data);
        initLogger.info("[STEP-7] => Received and applied policy/configuration", JSON.stringify(policy.data));
        if (NRAgent && NRAgent.config.security.detection) {
            logger.info('Security detection flags:', JSON.stringify(NRAgent.config.security.detection));
        }
        return true;
    }
}

// function to setup default policy provided in resources directory
function setDefaultPolicy() {
    try {
        policy = getInstance();
        policy.data = default_policy;
        logger.info(LOG_MESSAGES.DEFAULT_POL_SET, JSON.stringify(policy.data));
    } catch (e) {
        logger.error(LOG_MESSAGES.UNABLE_SET_DEFAULT_POL, e);
    };
}

/**
 * Function to set applicationInfo with updated policy version
 * @param {*} policy
 * @param {*} data
 */
function appInfoVersionUpdate(policy, data) {
    const appInfo = require('./applicationinfo').getInstance();
    const { Agent } = require('./agent');
    appInfo.policyVersion = data.version || policy.data.version;
    if (NRAgent && appInfo.entityGuid) {
        Agent.getAgent().setApplicationInfo(appInfo);
    }
}

module.exports = {
    getInstance,
    setPolicyData,
    setDefaultPolicy
};
