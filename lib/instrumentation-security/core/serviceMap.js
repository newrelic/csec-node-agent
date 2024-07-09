/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const outboundConnectionSet = new Set();


function addOutboundConnection(connectionObject) {
    outboundConnectionSet.add(connectionObject)
}

/**
 * Utility to get all external connections
 * @returns all keys from routeMap
 */
function getAllOutboundConnections() {
    return outboundConnectionSet;
}

function clearConnectionSet(){
    outboundConnectionSet.clear();
}

module.exports = {
    addOutboundConnection,
    clearConnectionSet,
   getAllOutboundConnections
}