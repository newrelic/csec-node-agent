/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

let logger;
const IASTUtil = require('./IASTUtils');
module.exports.handler = function handler (json) {
    logger.debug('IAST record deletion command received:', JSON.stringify(json));
    let deletionList =  json.arguments;
    deletionList.forEach(element => {
        IASTUtil.removeRequestId(element);
    });

};

module.exports.setLogger = l => { logger = l };