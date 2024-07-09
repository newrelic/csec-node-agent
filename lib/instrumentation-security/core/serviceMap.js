/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const outboundConnectionSet = new Set();
const inboundConnectionSet = new Set();



function addOutboundConnection(connectionObject) {
    outboundConnectionSet.add(connectionObject)
}

function addInboundConnection(connectionObject) {
    inboundConnectionSet.add(connectionObject)
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
}

module.exports = {
    addOutboundConnection,
    clearConnectionSet,
    addInboundConnection,
    getAllInboundConnections,
    getAllOutboundConnections
}