
/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const API = require('../../../nr-security-api');

/**
 * Returns the linkingMetadata,
 * creates one if not already created.
 *
 * @returns {LinkingMetadata} instance
 */
function getLinkingMetadata () {
    return API.newrelic.getLinkingMetadata();
}

module.exports = {
    getLinkingMetadata,
};
