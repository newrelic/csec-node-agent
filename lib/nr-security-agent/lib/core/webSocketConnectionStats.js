/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

function WebSocketConnectionStats() {
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.connectionReconnected = 0;
    this.connectionFailure = 0;
    this.receivedReconnectAtWill = 0;
    this.sendFailure = 0;

}
WebSocketConnectionStats.prototype.constructor = WebSocketConnectionStats;

/**
 * Returns the current instanceof WebSocketConnectionStats
 * 
 * @returns {WebSocketConnectionStats} instance
 */
function getInstance() {
        return new WebSocketConnectionStats();
}


module.exports = {
    getInstance
};