/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */
const { Agent } = require('../../../agent');
let completedRequestIds = new Set();
const PolicyManager = require('../../../Policy');
let batchSize;
const batchthreshold = 40;
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
    const policyInstance = PolicyManager.getInstance();
    if (policyInstance.data && policyInstance.data.vulnerabilityScan && policyInstance.data.vulnerabilityScan.iastScan) {
        batchSize = batchSize ? batchSize : policyInstance.data.vulnerabilityScan.iastScan.probing.batchSize;
        if (batchSize > batchthreshold) {
            batchSize = policyInstance.data.vulnerabilityScan.iastScan.probing.batchSize;
        }
    }
    if (getCompletedRequestIds().length >= batchSize || batchSize < batchthreshold) {
        batchSize = (2 * batchSize);
    }
    let object = {};
    object['jsonName'] = 'iast-data-request';
    object['applicationUUID'] = Agent.getAgent().applicationInfo.applicationUUID;
    object["batchSize"] = batchSize ? batchSize : 300;
    object['completedRequestIds'] = getCompletedRequestIds();
    return object;

}


module.exports = {
    getCompletedRequestIds,
    addRequestId,
    removeRequestId,
    generateIASTDataRequest,
}


