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


module.exports = function initialize(shim, memcached, moduleName) {
  logger.info('Instrumenting ' + moduleName)
  const utils = shim.require('./lib/utils');
  validateArgHook(shim, utils, 'validateArg');
}


function prepareSecurityArgs(args) {
  const obj = args[0];
  let parameters = Object.create(null);
  try {
    if (obj) {
      parameters.type = obj['type'];
      parameters.key = obj['key'];
      if(obj['value']){
        parameters.value = JSON.parse(obj['value']);
      }
      parameters.command = obj['command'];
    }
  } catch (error) {
    logger.debug("Error in preparing memcached parameters:",error);
  }
  
  return parameters;
}

/**
 * Wrapper to hook validateArg method
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} method 
 */
function validateArgHook(shim, mod, method) {
  shim.wrap(mod, method, function makeQueryWrapper(shim, fn) {
    return function queryWrapper() {
      let params = prepareSecurityArgs(arguments);
      shim.params = params;
      const request = requestManager.getRequest(shim);

      if (request) {
        const traceObject = secUtils.getTraceObject(shim);
        traceObject.sourceMethod = method;
        const secMetadata = securityMetaData.getSecurityMetaData(request, params, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DB_COMMAND, EVENT_CATEGORY.MEMCACHED)
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
    };
  });
}