/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
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