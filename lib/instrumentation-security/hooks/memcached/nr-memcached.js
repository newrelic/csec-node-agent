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

const OperationMap = {
  'set': 'write',
  'get': 'read',
  'gets': 'read',
  'replace': 'update',
  'add': 'write',
  'cas': 'write',
  'append': 'write',
  'prepend': 'write',
  'delete': 'delete',
  'touch': 'update',
  'incr': 'update',
  'decr': 'update',
  'version': 'read',
  'flush_all': 'delete',
  'stats': 'read',
  'stats settings': 'read',
  'stats slabs': 'read',
  'stats items': 'read',
  'stats cachedump': 'read'

}

module.exports = function initialize(shim, memcached, moduleName, additionalMod) {
  logger.info('Instrumenting ' + moduleName)
  let utils;
  if (additionalMod) {
    utils = additionalMod;
  }
  else {
    utils = shim.require('./lib/utils');
  }
  validateArgHook(shim, utils, 'validateArg');
}


function prepareSecurityArgs(args) {
  const obj = args[0];
  let parameters = Object.create(null);
  try {
    if (obj) {
      parameters.mode = obj['type'];
      let params = [];
      params.push(obj['key'].toString());
      if (obj['value']) {
        params.push(obj['value']);
      }
      parameters.arguments = params;
      parameters.type = OperationMap[parameters.mode]? OperationMap[parameters.mode]: 'unknown';
    }
  } catch (error) {
    logger.debug("Error in preparing memcached parameters:", error);
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
      shim.interceptedArgs = params;
      const request = requestManager.getRequest(shim);

      if (request) {
        const traceObject = secUtils.getTraceObject(shim);
        traceObject.sourceMethod = method;
        const secMetadata = securityMetaData.getSecurityMetaData(request, params, traceObject, secUtils.getExecutionId(), EVENT_TYPE.CACHING_DATA_STORE, EVENT_CATEGORY.MEMCACHED)
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

