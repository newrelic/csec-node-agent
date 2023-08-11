/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

const requestMap = new Map();

/**
 * Utility to get request by transaction Id
 * @param {*} id 
 * @returns 
 */
function getRequestFromId(id) {
    return requestMap.get(id);
}

/**
 * Utility function to set request data corresponding to transacation Id
 * @param {*} id 
 * @param {*} requestData 
 */
function setRequest(id, requestData) {
    requestMap.set(id, requestData);
}

/**
 * Utility to get request using shim
 * @param {*} shim 
 * @returns 
 */
function getRequest(shim) {
    const segment = shim.getActiveSegment();
    if (segment) {
        const transactionId = segment.transaction.id;
        return getRequestFromId(transactionId);
    }
    else if (shim.agent.getLinkingMetadata()) {
        let linkingMetadata = shim.agent.getLinkingMetadata();
        if (linkingMetadata['trace.id']) {
            let traceId = linkingMetadata['trace.id'];
            return getRequestFromId(traceId);
        }
    }
}

/**
 * Utility to update request body
 * @param {*} shim 
 * @param {*} data 
 */
function updateRequestBody(shim, data) {
    const segment = shim.getActiveSegment();
    if (segment) {
        const transactionId = segment.transaction.id;
        const requestData = getRequestFromId(transactionId);
        if (requestData) {
            requestData.body = data;
            setRequest(transactionId, requestData);
        }
    }
    if (shim.agent.getLinkingMetadata()) {
        let linkingMetadata = shim.agent.getLinkingMetadata();
        if (linkingMetadata['trace.id']) {
            let traceId = linkingMetadata['trace.id'];
            const requestData = getRequestFromId(traceId);
            if (requestData) {
                requestData.body = data;
                setRequest(traceId, requestData)
            }
        }
    }
}

/**
 * Utility to clear data based on transaction Id 
 * @param {*} transactionId 
 */
function gcRequestMap(transaction) {
    let transactionId = transaction.id;
    let traceId = transaction._traceId;
    if (requestMap.has(transactionId)) {
        requestMap.delete(transactionId);
    }
    if (requestMap.has(traceId)) {
        requestMap.delete(traceId);
    }
}

module.exports = {
    getRequestFromId,
    getRequest,
    setRequest,
    updateRequestBody,
    gcRequestMap,
    requestMap
}