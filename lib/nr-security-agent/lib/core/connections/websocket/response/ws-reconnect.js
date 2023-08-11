/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

let logger;
module.exports.handler = function handler (json) {
    logger.info('WS reconnect received', json);
    const { Agent } = require('../../../agent');
    const wsClient = Agent.getAgent().client;
    wsClient.obeyReconnect();
};

module.exports.setLogger = l => { logger = l };
