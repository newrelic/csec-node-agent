
/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

let logger;

module.exports.handler = function handler (json) {
    try {
        const error = json.data;
        logger.error("Policy updation faild due to violation:", error);
    } catch (error) {
        logger.error('paring exception while parsing configuration', error);
    }
};

module.exports.setLogger = l => { logger = l };