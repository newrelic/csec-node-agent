/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

let logger;

module.exports.handler = function handler (json) {
    logger.info('IAST cool down command received:', json);
};

module.exports.setLogger = l => { logger = l };
