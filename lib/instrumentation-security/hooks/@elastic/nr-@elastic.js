/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

const requestManager = require("../../core/request-manager");

const secUtils = require('../../core/sec-utils');
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');
const logger = API.getLogger();
const semver = require('semver');


module.exports = initialize;

/**
 * Entry point of mysql and msyql2 module hooks
 * @param {*} shim 
 * @param {*} mysql 
 * @param {*} moduleName 
 */
function initialize(shim, elastic, moduleName) {
  logger.info("Instrumenting", moduleName);

  const pkgVersion = shim.require('./package.json').version
  if (semver.lt(pkgVersion, '7.13.0')) {
    logger.debug(`ElasticSearch support is for versions 7.13.0 and above. Not instrumenting ${pkgVersion}.`)
    return;
  }
  requestHook(shim, elastic.Transport.prototype, 'request');

}

function requestHook(shim, mod, methodName) {
  shim.wrap(mod, methodName, function makeWrapper(shim, fn) {
    return function wrapper() {
      try {
        shim.interceptedArgs = arguments[0];
        const request = requestManager.getRequest(shim);
        if (request) {
          const traceObject = secUtils.getTraceObject(shim);
          const secMetadata = securityMetaData.getSecurityMetaData(request, shim.interceptedArgs, traceObject, secUtils.getExecutionId(), EVENT_TYPE.NOSQL_DB_COMMAND, EVENT_CATEGORY.ELASTIC_SEARCH)
          const secEvent = API.generateSecEvent(secMetadata);
          API.sendEvent(secEvent);
        }
      } catch (error) {
        logger.debug("error:",error);
      }

      return fn.apply(this, arguments);
    };
  });
}
