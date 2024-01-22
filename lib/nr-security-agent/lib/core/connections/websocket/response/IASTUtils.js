/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */
const { Agent } = require('../../../agent');
let pendingRequestIds = new Set();
let completedRequestsMap = new Map();
const PolicyManager = require('../../../Policy');
let batchSize;
const batchthreshold = 160;
function getPendingRequestIds() {
    return [...pendingRequestIds];
}

function addPendingRequestId(id) {
    pendingRequestIds.add(id);
}

function removeRequestId(id) {
    completedRequestsMap.delete(id);
}

function removePendingRequestId(id) {
    pendingRequestIds.delete(id);
}

// for last leg
function completedRequestsMapInit(id) {
    completedRequestsMap.set(id, []);
}

function addCompletedRequests(id, eventId) {
    let data = completedRequestsMap.get(id);
    data.push(eventId);
    completedRequestsMap.set(id, data);
}

function getCompletedRequestsMap() {
    return completedRequestsMap;
}

function clearCompletedRequestMap(){
    completedRequestsMap.clear();
}

function clearPendingRequestIdSet(){
    pendingRequestIds.clear();
}

function IASTCleanup(){
    clearCompletedRequestMap();
    clearPendingRequestIdSet();
}

function generateIASTDataRequest() {
    const policyInstance = PolicyManager.getInstance();
    if (policyInstance.data && policyInstance.data.vulnerabilityScan && policyInstance.data.vulnerabilityScan.iastScan) {
        batchSize = batchSize ? batchSize : policyInstance.data.vulnerabilityScan.iastScan.probing.batchSize;
        if (batchSize > batchthreshold) {
            batchSize = policyInstance.data.vulnerabilityScan.iastScan.probing.batchSize;
        }
    }
    if (getCompletedRequestsMap().size >= batchSize || batchSize < batchthreshold || getPendingRequestIds().length < batchSize) {
        batchSize = (2 * batchSize);
    }
    let object = {};
    object['jsonName'] = 'iast-data-request';
    object['applicationUUID'] = Agent.getAgent().applicationInfo.applicationUUID;
    object["batchSize"] = batchSize ? batchSize : 300;
    object['pendingRequestIds'] = getPendingRequestIds();
    object['completedRequests'] = Object.fromEntries(getCompletedRequestsMap());
    return object;
}


module.exports = {
    getPendingRequestIds,
    addPendingRequestId,
    removePendingRequestId,
    generateIASTDataRequest,

    // for last leg
    addCompletedRequests,
    completedRequestsMapInit,
    getCompletedRequestsMap,
    removeRequestId,
    IASTCleanup



}


