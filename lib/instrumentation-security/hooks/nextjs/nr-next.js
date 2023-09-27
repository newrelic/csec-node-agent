/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'
const requestManager = require("../../core/request-manager");
const secUtils = require('../../core/sec-utils');
const { ATTHERATE, DOUBLE_DOLLAR } = require('../../core/constants');
const lodash = require('lodash');
const routeManager = require('../../core/route-manager');
const semver = require('semver')
const url = require('url');
const API = require("../../../nr-security-api");
const { match } = require("assert");
const logger = API.getLogger();




module.exports = function initialize(shim, nextjs, moduleName) {
  const pkgVersion = shim.require('package.json').version;
  logger.info("Instrumenting nextjs", nextjs, pkgVersion);

  let utils = shim.require('./dist/next-server/lib/router/utils');
  console.log('utils is:', utils);

  let dest = shim.require('./dist/next-server/lib/router/utils/prepare-destination');
  console.log('dest is:', dest, dest.getSafeParamName);

  let router = shim.require('./dist/next-server/lib/router/router');
  console.log("router is:", router);

  let nextServer = shim.require('./dist/next-server/server/next-server');
  let Server = nextServer.default;
  console.log('nextServer is:', Server.prototype.runMiddleware, Server.prototype.runApi);

  let foo = shim.require('./dist/next-server/server/next-server');
  console.log("foo:", Object.getPrototypeOf(foo.default));



  shim.wrap(utils, 'isDynamicRoute', function wrapParam(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
    return function wrappedParam() {
      const route = fn.apply(this, arguments)
      console.log("isDynamicRoute args:", arguments, route, this)
      return route
    }
  })


  shim.wrap(utils, 'getRouteMatcher', function wrapGetRouterMatcher(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
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
