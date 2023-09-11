/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */


'use strict'

const requestManager = require('../../core/request-manager');
const secUtils = require('../../core/sec-utils');
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const logger = API.getLogger();
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');

module.exports = function initialize(shim, redis, moduleName) {
  const redisVersion = shim.require('./package.json').version;
  const proto = redis?.RedisClient?.prototype;
  if (!proto) {
    return false;
  }

  logger.info('Instrumenting',moduleName, redisVersion);
  if (proto.internal_send_command) {
    internalSendCommandHook(shim, proto);
  } else {
    SendCommandHook(shim, proto);
  }
}


/**
 * Instrumentation used in versions of redis > 2.6.1 < 4 to record all redis commands
 *
 * @param {Shim} shim instance of shim
 * @param {object} proto RedisClient prototype
 */
function internalSendCommandHook(shim, proto) {

  shim.wrap(proto, 'internal_send_command', function wrapInternalSendCommand(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn;
    }
    return function wrappedInternalSendCommand() {
      const commandObject = arguments[0];
      const keys = commandObject.args;
      const commandName = commandObject.command || 'unknown';

      const payloadData = {
        payloadType: commandName,
        payload: keys
      }

      shim.interceptdArgs = payloadData;
      const request = requestManager.getRequest(shim);
      if (request) {
        const traceObject = secUtils.getTraceObject(shim);
        const secMetadata = securityMetaData.getSecurityMetaData(request, payloadData, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DB_COMMAND, EVENT_CATEGORY.REDIS)
        this.secEvent = API.generateSecEvent(secMetadata);
        API.sendEvent(this.secEvent);
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
 * Instrumentation used in versions of redis < 2.6.1 to record all redis commands
 *
 * @param {Shim} shim instance of shim
 * @param {object} proto RedisClient prototype
 */
function SendCommandHook(shim, proto) {
  shim.wrap(proto, 'send_command', function wrapSendCommand(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn;
    }
    return function wrappedSendCommand() {
      const command = arguments[0];
      let keys = arguments[1];
      const commandName = command || 'unknown';

      for (let i = 0; i < keys.length; i++) {
        if (shim.isFunction(keys[i])) {
          keys.splice(i, 1);
        }
      }

      const payloadData = {
        payloadType: commandName,
        payload: keys
      }

      shim.interceptdArgs = payloadData;
      const request = requestManager.getRequest(shim);
      if (request) {
        const traceObject = secUtils.getTraceObject(shim);
        const secMetadata = securityMetaData.getSecurityMetaData(request, payloadData, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DB_COMMAND, EVENT_CATEGORY.REDIS)
        this.secEvent = API.generateSecEvent(secMetadata);
        API.sendEvent(this.secEvent);
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



