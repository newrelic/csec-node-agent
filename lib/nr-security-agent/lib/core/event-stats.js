/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

let eventStats = undefined;
function EventStats() {
    this.processed = 0;
    this.sent = 0;
    this.rejected = 0;
    this.errorCount = 0;
}
EventStats.prototype.constructor = EventStats;

/**
 * Returns the current instanceof EventStats
 * 
 * @returns {EventStats} instance
 */
function getInstance() {
        return new EventStats();
}


module.exports = {
    getInstance
};