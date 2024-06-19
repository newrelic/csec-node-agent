/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

function IASTReplayRequest() {
    this.receivedControlCommands = 0;
    this.processedControlCommands = 0;
    this.pendingControlCommands = 0;
    this.replayRequestGenerated = 0;
    this.replayRequestExecuted = 0;
    this.replayRequestSucceeded = 0;
    this.replayRequestFailed = 0;
    this.replayRequestRejected = 0;

}
IASTReplayRequest.prototype.constructor = IASTReplayRequest;

/**
 * Returns the current instanceof iastReplayRequest
 * 
 * @returns {IASTReplayRequest} instance
 */
function getInstance() {
        return new IASTReplayRequest();
}


module.exports = {
    getInstance
};