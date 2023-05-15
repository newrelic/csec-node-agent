/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const requestManager = require('../../../core/request-manager');
const secUtils = require('../../../core/sec-utils');
const API = require("../../../../nr-security-api");
const securityMetaData = require('../../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../../core/event-constants');
const logger = API.getLogger();
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../../core/constants');

/**
 * Middleware hook that records the middleware chain
 * when command is in a list of monitored commands.
 *
 * @param {Shim} shim
 * @param {Object} config AWS SDK client configuration
 * @param {function} next middleware function
 * @param {Object} context Context for the running command
 * @returns {function}
 */
function dynamoMiddleware(shim, config, next, context) {
  return async function wrappedMiddleware(args) {
    const request = requestManager.getRequest(shim);
    if (args.constructor) {
      const command = args.constructor.name;
      const input = args.input;
      const parameters = {
        payloadType: command,
        payload: input
      }
      shim.interceptedArgs = parameters;
      if (request) {
        const traceObject = secUtils.getTraceObject(shim);
        const secMetadata = securityMetaData.getSecurityMetaData(request, parameters, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DYNAMO_DB_COMMAND, EVENT_CATEGORY.DQL)
        const secEvent = API.generateSecEvent(secMetadata);
        this.secEvent = secEvent;
        API.sendEvent(secEvent);
      }
    }
    const result = next(args);
    if (result && request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
      API.generateExitEvent(this.secEvent);
      delete this.secEvent
    }
    return result;
  }
}

module.exports = {
  dynamoMiddleware
}
