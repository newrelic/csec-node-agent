
/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

let logger;

module.exports.handler = function handler(json) {
    try {
        const policyData = json.data;
        const PolicyManager = require('../../../Policy');
        PolicyManager.setPolicyData(policyData);
        
    } catch (error) {
        logger.error('paring exception while parsing configuration', error);
    }
};

module.exports.setLogger = l => { logger = l };