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
  const ioredisVersion = shim.require('./package.json').version
  logger.info('Instrumenting ' + moduleName, ioredisVersion)
  const proto = redis && redis.prototype;

  shim.wrap(proto, 'sendCommand', function wrapSendCommand(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn;
    }
    return function wrappedSendCommand() {
      const command = arguments[0];
      const keys = command.args;
      const commandName = command.name || 'unknown';
      // const key = keys[0];
      // const values = keys.slice(1, keys.length);
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



