/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */


'use strict'

const requestManager = require('../../../core/request-manager');
const secUtils = require('../../../core/sec-utils');
const API = require("../../../../nr-security-api");
const securityMetaData = require('../../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../../core/event-constants');
const logger = API.getLogger();
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../../core/constants');


const typeMap = {
  'scan': 'read',
  'get': 'read',
  'put': 'write',
  'update': 'update',
  'delete': 'delete',
  'batchGet': 'read',
  'batchWrite': 'write',
  'transactGet': 'read',
  'transactWrite': 'write',
  'query': 'read',
  'putItem': 'write',
  'getItem': 'read',
  'updateItem': 'update',
  'deleteItem': 'delete',
  'createTable': 'unknown',
  'deleteTable': 'unknown'
}

module.exports = function initialize(shim, AWS, moduleName) {
  logger.info('Instrumenting ' + moduleName);
  const dynamoDBVersion = shim.require("./package.json").version;
  logger.debug(`${moduleName} version:`,dynamoDBVersion)
  const dynamoDB = AWS.DynamoDB;
  makeRequestHook(shim, dynamoDB && dynamoDB.prototype, 'makeRequest');
}

/**
 * Wrapper to wrap makeRequest function.
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} method 
 */
function makeRequestHook(shim, mod, method) {
  shim.wrap(mod, method, function makeQueryWrapper(shim, fn) {
    return function queryWrapper() {
      const request = requestManager.getRequest(shim);
      try {
        let operation = arguments[0];
        let payloadType = typeMap[operation] ? typeMap[operation] : "unknown";
        const parameters = {
          payloadType: payloadType,
          payload: secUtils.camelCaseKeys(arguments[1])
        }

        shim.interceptedArgs = parameters;
        if (request) {
          const traceObject = secUtils.getTraceObject(shim);
          const secMetadata = securityMetaData.getSecurityMetaData(request, parameters, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DYNAMO_DB_COMMAND, EVENT_CATEGORY.DQL)
          const secEvent = API.generateSecEvent(secMetadata);
          this.secEvent = secEvent;
          API.sendEvent(secEvent);
        }
      } catch (error) {
        logger.warn("Error while intercepting DynamoDB", error);
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



