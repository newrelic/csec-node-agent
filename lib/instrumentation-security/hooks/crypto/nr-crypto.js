/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
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
    return function wrapper() {
      const interceptedArgs = [arguments[0]];
      shim.interceptedArgs = interceptedArgs;
      const request = requestManager.getRequest(shim);
      if (request) {
        const traceObject = secUtils.getTraceObject(shim);
        const secMetadata = securityMetaData.getSecurityMetaData(request, interceptedArgs, traceObject, secUtils.getExecutionId(), EVENT_TYPE.CIPHER, EVENT_CATEGORY.CRYPTO)
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