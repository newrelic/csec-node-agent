
/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const { Agent } = require('./agent');

let policy;
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const logs = require('./logging');
const logger = logs.getLogger();
const initLogger = logs.getInitLogger();
const jsonValidator = require('./jsonValidator');
const LOG_MESSAGES = require('./sec-agent-constants').LOG_MESSAGES;
const statusUtils = require('./statusUtils');

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
    const jsonValidationResult = jsonValidator.validate(data);
    if (jsonValidationResult && jsonValidationResult.errors && jsonValidationResult.errors.length > 0) {
        logger.error(LOG_MESSAGES.EXP_RAISE_POL, JSON.stringify(jsonValidationResult.errors));
        logger.info(LOG_MESSAGES.FALLBACK_TO_CURR_POLICY, JSON.stringify(policy.data));
        return false;
    }
    if (policy.data.version !== data.version) {
        policy.data = data;
        appInfoVersionUpdate(policy, data);
        initLogger.info("[STEP-7] => Received and applied policy/configuration", JSON.stringify(policy.data));
        logger.info('Applied policy is:', JSON.stringify(policy.data));
        if (NRAgent && NRAgent.config.security.detection) {
            logger.info('Security detection flags:', JSON.stringify(NRAgent.config.security.detection));
        }
        return true;
    }
}

// function to setup default policy provided in resources directory
function setDefaultPolicy() {
    let default_policy_file = path.resolve(__dirname, '../../resources/default-policy.yaml');
    if(process.platform == 'win32'){
        default_policy_file = path.resolve(__dirname, '..\\..\\resources\\default-policy.yaml');
    }
    // Get document, or throw exception on error
    try {
        const default_policy = yaml.load(fs.readFileSync(default_policy_file, 'utf8'));
        policy = getInstance();
        policy.data = default_policy;
        logger.info(LOG_MESSAGES.DEFAULT_POL_SET, JSON.stringify(policy.data));
    } catch (e) {
        logger.error(LOG_MESSAGES.UNABLE_SET_DEFAULT_POL, e);
        statusUtils.addErrortoBuffer(e);
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

/**
 * Function to send updated policy to validator
 * @param {*} data 
 */
function sendUpdatedPolicy(data) {
    const wsClient = Agent.getAgent().client;
    let updatedPolicy = Object.assign({}, data);
    updatedPolicy.jsonName = 'lc-policy';
    wsClient.dispatcher(updatedPolicy);
}
module.exports = {
    getInstance,
    setPolicyData,
    setDefaultPolicy
};
