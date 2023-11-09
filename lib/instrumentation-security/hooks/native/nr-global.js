/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

const requestManager = require("../../core/request-manager");
const secUtils = require("../../core/sec-utils");
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');
const logger = API.getLogger();

function initialize(newrelic) {
  logger.info('Instrumenting global');
  evalHook(newrelic.shim, global, "eval");
  // evalHookViaEs6Proxies();



}
/**
 * Wrapper to hook eval 
 * @param {*} shim 
 * @param {*} childProcess 
 * @param {*} moduleName 
 */
function evalHook(shim, global, methodName) {
  shim.wrap(global, methodName, function makeEvalWrapper(shim, fn) {
    return function evalWrapper() {
      try {
        if (!shim.isFunction(fn) && !this && this === undefined) {
          return fn
        }
        const interceptedArgs = [arguments[0]];
        shim.interceptedArgs = interceptedArgs;
        const request = requestManager.getRequest(shim);
        if (request && arguments[0]) {
          const traceObject = secUtils.getTraceObject(shim);
          const secMetadata = securityMetaData.getSecurityMetaData(request, interceptedArgs, traceObject, secUtils.getExecutionId(), EVENT_TYPE.JAVASCRIPT_INJECTION, EVENT_CATEGORY.JAVASCRIPT_INJECTION)
          this.secEvent = API.generateSecEvent(secMetadata);
          API.sendEvent(this.secEvent);
        }
        console.log("args:", arguments, this);
        const result = fn.apply(this, arguments);

        if (result && request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
          API.generateExitEvent(this.secEvent);
          delete this.secEvent
        }
        return result;
      } catch (error) {
        logger.error("error while hooking eval function:", error);
      }

    };
  });
}

// function not in use
function evalHookViaEs6Proxies() {
  const originalEval = global.eval;

  const handler = {
    apply(target, thisArg, args) {
      // Add custom functionality before calling the original `eval`
      console.log('Patched eval called with:', args);

      // Call the original `eval`
      const result = Reflect.apply(target, thisArg, args);

      // Add custom functionality after calling the original `eval`
      console.log('Original eval returned:', result);

      // Return the result of the original `eval`
      return result;
    },
  };

  // Create a proxy for the eval function
  const proxyEval = new Proxy(originalEval, handler);
  global.eval = proxyEval;
}

module.exports = {
  initialize
}