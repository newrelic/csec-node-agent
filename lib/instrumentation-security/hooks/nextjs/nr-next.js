/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'
const requestManager = require("../../core/request-manager");
const API = require("../../../nr-security-api");
const logger = API.getLogger();


module.exports = function initialize(shim, nextjs) {
  const pkgVersion = shim.require('package.json').version;
  logger.info("Instrumenting nextjs", pkgVersion);

  const utils = shim.require('./dist/next-server/lib/router/utils');
  const router = shim.require('./dist/client/router');
  console.log("router:",router);

  shim.wrap(router, 'useRouter', function wrapUseRouter(shim, fn){
    logger.debug(`Instrumenting router.useRouter`)
    return function wrappedUseRouter(){
      console.log("args:",arguments);
      return fn.apply(this, arguments);
    }
  })

  if (utils) {
    getRouteMatcherHook(utils);
  }
  
  const routeMatcher = shim.require('./dist/shared/lib/router/utils/route-matcher.js');

  if (routeMatcher) {
    getRouteMatcherHook(routeMatcher);
  }

  function getRouteMatcherHook(mod) {
    shim.wrap(mod, 'getRouteMatcher', function wrapGetRouterMatcher(shim, fn) {
      if (!shim.isFunction(fn)) {
        return fn
      }
      logger.debug(`Instrumenting route-matcher.getRouteMatcher`)
      return function wrappedGetRouterMatcher() {
        let result = fn.apply(this, arguments)
        if (!shim.isFunction(result)) {
          return result;
        }
        let original = result;
        result = function () {
          const res = original.apply(this, arguments);
          extractParams(this, res);
          return res;
        }
        return result
      }
    })
  }

  /**
   * Utility to extact path params
   * @param {*} obj 
   * @param {*} params 
   */
  function extractParams(obj, params) {
    try {
      const segment = shim.getActiveSegment();
      if (segment && segment.transaction) {
        let request = requestManager.getRequestFromId(segment.transaction.id);
        Object.keys(params).forEach(function (key) {
          if (params[key]) {
            if (!request.parameterMap[key]) {
              request.parameterMap[key] = new Array(params[key].toString());
              requestManager.setRequest(segment.transaction.id, request);
            }
          }
        });
        if (request && obj && obj.page) {
          request.uri = obj.page;
          requestManager.setRequest(segment.transaction.id, request);
        }
      }
    } catch (error) {
    }
  }

}
