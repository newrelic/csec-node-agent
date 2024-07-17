/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const outboundConnectionSet = new Set();
const inboundConnectionSet = new Set();
const outboundConnectionMap = new Map();
const inboundConnectionMap = new Map();



function addOutboundConnection(connectionObject) {
    if (connectionObject.connectionURL && outboundConnectionMap.has(connectionObject.connectionURL)) {
        let connObject = outboundConnectionMap.get(connectionObject.connectionURL);
        connObject.count++;
        outboundConnectionMap.set(connObject.connectionURL, connObject)
        outboundConnectionSet.add(connObject)
    }
    else {
        connectionObject.count = 1;
        outboundConnectionMap.set(connectionObject.connectionURL, connectionObject);
        outboundConnectionSet.add(connectionObject)
    }

}

function addInboundConnection(connectionObject) {
    if (connectionObject.url && inboundConnectionMap.has(connectionObject.url)) {
        let connObject = inboundConnectionMap.get(connectionObject.url);
        connObject.count++;
        inboundConnectionMap.set(connObject.url, connObject);
        inboundConnectionSet.add(connObject);
    }
    else {
        connectionObject.count = 1;
        inboundConnectionMap.set(connectionObject.url, connectionObject);
        inboundConnectionSet.add(connectionObject)
    }

}

/**
 * Utility to get all external connections
 * @returns all keys from routeMap
 */
function getAllOutboundConnections() {
    return outboundConnectionSet;
}

function getAllInboundConnections() {
    return inboundConnectionSet
}

function clearConnectionSet() {
    outboundConnectionSet.clear();
    inboundConnectionSet.clear();
    outboundConnectionMap.clear();
    inboundConnectionMap.clear();
}

module.exports = {
    addOutboundConnection,
    clearConnectionSet,
    addInboundConnection,
    getAllInboundConnections,
    getAllOutboundConnections
}