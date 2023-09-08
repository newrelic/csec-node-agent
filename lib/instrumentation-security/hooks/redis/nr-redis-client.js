/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
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
const CLIENT_COMMANDS = ['select', 'quit', 'SELECT', 'QUIT']

module.exports = function initialize(shim, redis, moduleName) {
  logger.info('Instrumenting ' + moduleName)
  const COMMANDS = Object.keys(shim.require('dist/lib/client/commands.js').default)
  const CMDS_TO_INSTRUMENT = [...COMMANDS, ...CLIENT_COMMANDS]

  shim.wrap(redis, 'createClient', function wrapCreateClient(shim, original) {
    return function wrappedCreateClient() {
      const client = original.apply(this, arguments);
      CMDS_TO_INSTRUMENT.forEach(cmd => {
        instrumentClientCommand(shim, client, cmd);
      });
      return client
    }
  })
}


/**
 * Instruments a given command on the client
 *
 * @param {Shim} shim shim instance
 * @param {object} client redis client instance
 * @param {string} cmd command to instrument
 */
function instrumentClientCommand(shim, client, cmd) {

  shim.wrap(client, cmd, function wrapRoute(shim, fn) {
    return function wrappedRoute() {
      const payloadData = {
        payloadType: cmd,
        payload: arguments,
      };
      shim.interceptedArgs = payloadData;
      const request = requestManager.getRequest(shim);
      if (request) {
        const traceObject = secUtils.getTraceObject(shim);
        const secMetadata = securityMetaData.getSecurityMetaData(request, payloadData, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DB_COMMAND, EVENT_CATEGORY.REDIS)
        this.secEvent  = API.generateSecEvent(secMetadata);
        API.sendEvent(this.secEvent);
      }
      const result =  fn.apply(this, arguments);
      if(result && request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]){
        API.generateExitEvent(this.secEvent);
        delete this.secEvent
      }
      return result;
    }
  })

}