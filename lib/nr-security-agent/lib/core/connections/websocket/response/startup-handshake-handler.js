/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

const StartupConfig = require('../../../startup-config');
const logs = require('../../../logging');
let logger = logs.getLogger();
const initLogger = logs.getInitLogger();
const LOG_MESSAGES = require('../../../sec-agent-constants').LOG_MESSAGES;
const applicationInfoModule = require('../../../applicationinfo');

module.exports.handler = function handler(json) {
    try {
        const startupConfig = StartupConfig.getInstance();
        startupConfig.config = json.data;
      
        initLogger.info(LOG_MESSAGES.AGENT_INIT_WITH_PROP, JSON.stringify(startupConfig.config));
        initLogger.info('Security Agent is now ACTIVE for', applicationInfoModule.getInstance().applicationUUID);

    } catch (error) {
        logger.error(LOG_MESSAGES.PARSING_EXP_WELCOME_MSG, error);
    }
};

// eslint-disable-next-line no-unused-vars
module.exports.setLogger = l => { logger = l };
