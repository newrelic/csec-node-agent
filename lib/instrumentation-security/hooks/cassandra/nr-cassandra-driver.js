/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const requestManager = require('../../core/request-manager');
const semver = require('semver')
const secUtils = require('../../core/sec-utils');
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const logger = API.getLogger();
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');

module.exports = function initialize(shim, cassandra, moduleName) {
  const cassandraVersion = shim.require('./package.json').version
  logger.info('Instrumenting ' + moduleName, cassandraVersion)
  const ClientProto = cassandra.Client.prototype
  if (semver.satisfies(cassandraVersion, '>=4.4.0')) {
    executeHook(shim, ClientProto, '_execute');
  } else {
    executeHook(shim, ClientProto, '_innerExecute');
  }
  executeHook(shim, ClientProto, 'batch');
}

/**
 * Utility to create parameters from intercepted arguments
 * @param {*} args 
 * @returns 
 */
function extractQueryArgs(args) {
  let query = args[0];
  let params = args[1];
  return {
    query: query,
    parameters: params ? params : []
  }
}

/**
 * Utility to create parameters from intercepted arguments
 * @param {*} args 
 * @returns 
 */
function findBatchQueryArg(args) {
  const sql = (args[0] && args[0][0]) || ''
  let query = sql.query || sql;
  let params = [];
  return {
    query: query,
    parameters: params
  }
}


/**
 * Wrapper to hook _execute, _innerExecute and batch method
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} method 
 */
function executeHook(shim, mod, method) {
  shim.wrap(mod, method, function makeQueryWrapper(shim, fn) {
    return function queryWrapper() {
      let parameters;
      if (method === 'batch') {
        parameters = findBatchQueryArg(arguments);
      }
      else {
        parameters = extractQueryArgs(arguments);
      }
      shim.interceptedArgs = parameters;
      const request = requestManager.getRequest(shim);
      if (request) {
        const traceObject = secUtils.getTraceObject(shim);
        traceObject.sourceMethod = method;
        const secMetadata = securityMetaData.getSecurityMetaData(request, parameters, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DB_COMMAND, EVENT_CATEGORY.CASSANDRA)
        const secEvent = API.generateSecEvent(secMetadata);
        API.sendEvent(secEvent);
        if (request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
          callbackHook(shim, arguments, arguments.length - 1, secEvent);
        }
      }
      return fn.apply(this, arguments);
    };
  });
}

/**
 * Callback hook to generate exit event
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} fun 
 * @param {*} secEvent 
 */
function callbackHook(shim, mod, fun, secEvent) {
  shim.secEvent = secEvent;
  shim.wrap(mod, fun, function callbackWrapper(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn;
    }
    return function wrapper() {
      if ((arguments[0] === null || arguments[0] === undefined) && shim.secEvent) {
        API.generateExitEvent(shim.secEvent);
        delete shim.secEvent;
      }
      return fn.apply(this, arguments);
    }
  })
}




