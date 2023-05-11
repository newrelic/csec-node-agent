/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */


'use strict'

const requestManager = require('../../core/request-manager');
const secUtils = require('../../core/sec-utils');
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const logger = API.getLogger();
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');




module.exports = function initialize(shim, clientDynamoDB, moduleName) {
  logger.info('Instrumenting ' + moduleName, clientDynamoDB)
  

}

/**
 * Wrapper to wrap query function.
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} method 
 */
function docClientHooks(shim, mod, method) {

  shim.wrap(mod, method, function makeQueryWrapper(shim, fn) {
    return function queryWrapper() {
      const parameters = arguments;
      shim.interceptedArgs = parameters;
      const request = requestManager.getRequest(shim);
      if (this.sec_hooked != secUtils.getExecutionId()) {
        console.log("parameters:", method, secUtils.getExecutionId(), parameters, request)
        this.sec_hooked = secUtils.getExecutionId();
      }

      // if (request ) {
      //   const traceObject = secUtils.getTraceObject(shim);
      //   traceObject.sourceMethod = method;
      //   const secMetadata = securityMetaData.getSecurityMetaData(request, parameters, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DB_COMMAND, EVENT_CATEGORY.MYSQL)
      //   const secEvent = API.generateSecEvent(secMetadata);
      //   API.sendEvent(secEvent);
      //   if (request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
      //     callbackHook(shim, arguments, arguments.length - 1, secEvent);
      //   }
      // }
      return fn.apply(this, arguments);
    };
  });
}

/**
 * Wrapper to wrap query function.
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} method 
 */
function makeRequestHook(shim, mod, method) {

  shim.wrap(mod, method, function makeQueryWrapper(shim, fn) {
    return function queryWrapper() {
      const parameters = arguments;
      shim.interceptedArgs = parameters;
      const request = requestManager.getRequest(shim);
      if (this.sec_hooked != secUtils.getExecutionId()) {
        console.log("parameters:", method, secUtils.getExecutionId(), parameters, request)
        this.sec_hooked = secUtils.getExecutionId();
      }

      // if (request ) {
      //   const traceObject = secUtils.getTraceObject(shim);
      //   traceObject.sourceMethod = method;
      //   const secMetadata = securityMetaData.getSecurityMetaData(request, parameters, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DB_COMMAND, EVENT_CATEGORY.MYSQL)
      //   const secEvent = API.generateSecEvent(secMetadata);
      //   API.sendEvent(secEvent);
      //   if (request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
      //     callbackHook(shim, arguments, arguments.length - 1, secEvent);
      //   }
      // }
      return fn.apply(this, arguments);
    };
  });
}


