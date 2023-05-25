/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */
const { Agent } = require('../../../agent');
let completedRequestIds = new Set();

function getCompletedRequestIds() {
    return [...completedRequestIds];
}

function addRequestId(id) {
    completedRequestIds.add(id);
}

function removeRequestId(id) {
    completedRequestIds.delete(id);
}

function generateIASTDataRequest() {
    let object = {};
    object['jsonName'] = 'iast-data-request';
    object['applicationUUID'] = Agent.getAgent().applicationInfo.applicationUUID;
    object["batchSize"] = 1000;
    object['completedRequestIds'] = getCompletedRequestIds();
    return object;

}

module.exports = {
    getCompletedRequestIds,
    addRequestId,
    removeRequestId,
    generateIASTDataRequest
}


