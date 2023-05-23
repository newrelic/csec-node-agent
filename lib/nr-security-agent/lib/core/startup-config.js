/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

let startupConfig = undefined;
function StartupConfig(){
    
}
StartupConfig.prototype.constructor = StartupConfig;

/**
 * Returns the current instanceof CollectorConfig,
 * creates one if not already created.
 * 
 * @returns {StartupConfig} instance
 */
function getInstance() {
    if (!startupConfig) {
        startupConfig = new StartupConfig();
        startupConfig.config = {};
        
    }
    return startupConfig;
}

module.exports = {
    getInstance
};