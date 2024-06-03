/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */
const { Agent } = require('../../../agent');
const PolicyManager = require('../../../Policy');
const microServiceUtils = require('../../../micro-service');
let batchSize;
const batchthreshold = 160;

// micro service changes
let completedReplay = new Set();
let errorInReplay = new Set();
let clearFromPending = new Set();


function removeRequestId(id) {
    if (completedReplay.has(id)) {
        completedReplay.delete(id);
    }
    else if (clearFromPending.has(id)) {
        clearFromPending.delete(id);
    }
}


function getClearFromPending() {
    return [...clearFromPending];
}

function IASTCleanup() {
    completedReplay.clear();
    errorInReplay.clear();
    clearFromPending.clear();
}

function addCompletedReplay(fuzzId) {
    completedReplay.add(fuzzId);
}

function addErrorInReplay(fuzzId) {
    errorInReplay.add(fuzzId);
}

function addClearFromPending(fuzzId) {
    clearFromPending.add(fuzzId);
}

function removeClearFromPending(fuzzId) {
    clearFromPending.delete(fuzzId);
}


function getCompletedReplay() {
    return completedReplay;
}

function generateIASTDataRequest() {
    const policyInstance = PolicyManager.getInstance();
    if (policyInstance.data && policyInstance.data.vulnerabilityScan && policyInstance.data.vulnerabilityScan.iastScan) {
        batchSize = batchSize ? batchSize : policyInstance.data.vulnerabilityScan.iastScan.probing.batchSize;
        if (batchSize > batchthreshold) {
            batchSize = policyInstance.data.vulnerabilityScan.iastScan.probing.batchSize;
        }
    }
    if (getCompletedReplay().size >= batchSize || batchSize < batchthreshold || getClearFromPending().length < batchSize) {
        batchSize = (2 * batchSize);
    }
    let object = {};
    object['jsonName'] = 'iast-data-request';
    object['applicationUUID'] = Agent.getAgent().applicationInfo.applicationUUID;
    object["batchSize"] = batchSize ? batchSize : 300;
    object['completedReplay'] = [...completedReplay];
    object['errorInReplay'] = [...errorInReplay];
    object['clearFromPending'] = [...clearFromPending];
    object['generatedEvent'] = microServiceUtils.getGeneratedEventsMap();

    return object;
}

function addGeneratedEvents(applicationUUID, parentId, eventId) {
    microServiceUtils.addGeneratedEvents(applicationUUID, parentId, eventId)
}


module.exports = {
    generateIASTDataRequest,

    // for last leg
    removeRequestId,
    IASTCleanup,
    addGeneratedEvents,
    addCompletedReplay,
    addErrorInReplay,
    addClearFromPending,
    removeClearFromPending,
    getCompletedReplay,
    getClearFromPending



}


