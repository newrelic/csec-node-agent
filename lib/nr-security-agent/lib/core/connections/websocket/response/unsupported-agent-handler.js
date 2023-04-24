/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const agentStatus = require('../../../agent-status');

let logger;
module.exports.handler = function handler (json) {
    const message = json.arguments[0];
    logger.error(message);
    const status = agentStatus.getInstance();
    const statusCode = 'DISABLED';
    status.setStatus(agentStatus.CSECAgentStatus.codes[statusCode]);
};

// eslint-disable-next-line no-unused-vars
module.exports.setLogger = l => { logger = l };