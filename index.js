/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const API = require('./lib/nr-security-api');
/**
 * Entry point of CSEC agent.
 * @param {*} agent  newrelic agent object
 * @returns 
 */
function start(NRAgentObject) {
    const agent = NRAgentObject.agent;
    API.newrelic = NRAgentObject;
    API.setNRAgent(agent);
    if (!agent.config.security.agent.enabled || agent.config.security.enabled == null) {
        return;
    }
    require('./lib/nr-security-agent');
}
module.exports = {
    API,
    start
}
