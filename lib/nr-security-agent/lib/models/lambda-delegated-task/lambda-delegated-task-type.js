/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

const SHA_CALCULATION = 'sha_calculation';

function LambdaDelegatedTaskType () {}

LambdaDelegatedTaskType.prototype = Object.create(null);
LambdaDelegatedTaskType.prototype.constructor = LambdaDelegatedTaskType;

LambdaDelegatedTaskType.SHA_CALCULATION = SHA_CALCULATION;

module.exports = {
    LambdaDelegatedTaskType
};
