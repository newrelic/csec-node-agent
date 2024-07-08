/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const connectionSet = new Set();


function addConnection(connectionObject) {
    connectionSet.add(connectionObject)
}

/**
 * Utility to get all external connections
 * @returns all keys from routeMap
 */
function getAllExternalConnections() {
    return connectionSet;
}

function clearConnectionSet(){
    connectionSet.clear();
}

module.exports = {
    addConnection,
    clearConnectionSet,
    getAllExternalConnections
}