/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier:  New Relic Software License v1.0
 */

module.exports = initialize
const requestManager = require('../../core/request-manager');
const secUtils = require("../../core/sec-utils");
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');
const logger = API.getLogger();

/**
 * Entry point of ldapjs and ldapts module hook
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} moduleName 
 */
function initialize(shim, mod, moduleName) {
    logger.info('Instrumenting ' + moduleName)
    cryptoCipherHooks(shim, mod, 'createCipheriv', moduleName);
    cryptoHashHmacHooks(shim, mod, 'createHash', moduleName);
    cryptoHashHmacHooks(shim, mod, 'createHmac', moduleName);
    // cryptoRandomHooks(shim, mod, 'randomInt', moduleName);
    // cryptoRandomHooks(shim, mod, 'randomBytes', moduleName);
    cryptoRandomHooks(shim, Math, 'random', "Math");
}
/**
 * wrapper to hook crypto cipher methods
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} methodName 
 * @param {*} moduleName 
 */
function cryptoCipherHooks(shim, mod, methodName, moduleName) {
    shim.wrap(mod, methodName, function makeWrapper(shim, fn) {
        logger.debug(`Instrumenting ${moduleName}.${methodName}`);
        return function wrapper() {
            const interceptedArgs = [arguments[0]];
            shim.interceptedArgs = interceptedArgs;
            const request = requestManager.getRequest(shim);
            if (request) {
                const traceObject = secUtils.getTraceObject(shim);
                const secMetadata = securityMetaData.getSecurityMetaData(request, interceptedArgs, traceObject, secUtils.getExecutionId(), EVENT_TYPE.CRYPTO, EVENT_CATEGORY.CIPHER)
                const secEvent = API.generateSecEvent(secMetadata);
                this.secEvent = secEvent;
                API.sendEvent(secEvent);
            }
            const result = fn.apply(this, arguments);

            if (result && request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
                API.generateExitEvent(this.secEvent);
                delete this.secEvent
            }
            return result;
        }
    })
}


/**
 * wrapper to hook crypto hash and mac methods
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} methodName 
 * @param {*} moduleName 
 */
function cryptoHashHmacHooks(shim, mod, methodName, moduleName) {
    shim.wrap(mod, methodName, function makeWrapper(shim, fn) {
        logger.debug(`Instrumenting ${moduleName}.${methodName}`);
        return function wrapper() {
            const interceptedArgs = [arguments[0]];
            shim.interceptedArgs = interceptedArgs;
            const request = requestManager.getRequest(shim);
            if (request) {
                const traceObject = secUtils.getTraceObject(shim);
                const secMetadata = securityMetaData.getSecurityMetaData(request, interceptedArgs, traceObject, secUtils.getExecutionId(), EVENT_TYPE.HASH, EVENT_CATEGORY.HASH)
                const secEvent = API.generateSecEvent(secMetadata);
                this.secEvent = secEvent;
                API.sendEvent(secEvent);
            }
            const result = fn.apply(this, arguments);
            if (result && request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
                API.generateExitEvent(this.secEvent);
                delete this.secEvent
            }
            return result;
        }
    })
}
/**
 * Wrapper for random hooks
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} methodName 
 * @param {*} moduleName 
 */
function cryptoRandomHooks(shim, mod, methodName, moduleName) {
    shim.wrap(mod, methodName, function makeWrapper(shim, fn) {
        logger.debug(`Instrumenting ${moduleName}.${methodName}`);
        return function wrapper() {
            const interceptedArgs = ["Math.random"];
            shim.interceptedArgs = interceptedArgs;
            const request = requestManager.getRequest(shim);
            if (request && arguments[0]) {
                const traceObject = secUtils.getTraceObject(shim);
                const secMetadata = securityMetaData.getSecurityMetaData(request, interceptedArgs, traceObject, secUtils.getExecutionId(), EVENT_TYPE.RANDOM, EVENT_CATEGORY.WEAKRANDOM)
                const secEvent = API.generateSecEvent(secMetadata);
                this.secEvent = secEvent;
                API.sendEvent(secEvent);
            }
            const result = fn.apply(this, arguments);
            if (result && request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
                API.generateExitEvent(this.secEvent);
                delete this.secEvent
            }
            return result;
        }
    })
}


