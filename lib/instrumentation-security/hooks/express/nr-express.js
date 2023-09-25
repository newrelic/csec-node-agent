/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

/**
 * Express middleware generates traces where middleware are considered siblings
 * (ended on 'next' invocation) and not nested. Middlware are nested below the
 * routers they are mounted to.
 */

const requestManager = require("../../core/request-manager");
const secUtils = require('../../core/sec-utils');
const { ATTHERATE, DOUBLE_DOLLAR } = require('../../core/constants');
const lodash = require('lodash');
const routeManager = require('../../core/route-manager');
const API = require("../../../nr-security-api");
const logger = API.getLogger();

module.exports = function initialize(shim, express, moduleName) {
  logger.info("Instrumenting express")
  if (!express || !express.Router) {
    return false
  }

  if (express.Router.use) {
    wrapExpress4(shim, express)
  } else {
    // wrapExpress3(shim, express)
  }
}

/**
 * Wrapper to hook express version 4.x route method
 * @param {*} shim 
 * @param {*} express 
 */
function wrapExpress4(shim, express) {
  shim.wrap(express.Router, 'route', function wrapRoute(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
    return function wrappedRoute() {
      try {
        const stakTrace = secUtils.traceElementForRoute();
        const splittedStack = stakTrace[0].split(DOUBLE_DOLLAR);
        const key = lodash.upperCase(splittedStack[1]) + ATTHERATE + arguments[0];
        routeManager.setRoute(key, splittedStack[0]);
      } catch (error) {

      }
      const route = fn.apply(this, arguments)
      return route;
    }
  })


  //Wrapper to hook process_params method to extract out path param and query params.
  shim.wrap(express.Router, 'process_params', function wrapParam(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
    return function wrappedParam() {
      extractParams(shim, arguments[2]);
      const route = fn.apply(this, arguments)
      return route
    }
  })
}
/**
 * Utility function to parse request obejct intercepted from express.router.process_params() method hook
 * @param {*} shim 
 * @param {*} req 
 */
function extractParams(shim, req) {
  if (!requestManager.getRequest(shim)) {
    secUtils.addRequestData(shim, req);
  }
  const segment = shim.getActiveSegment();
  if (segment && segment.transaction) {
    let request = requestManager.getRequestFromId(segment.transaction.id);
    if (req.params && request) {
      Object.keys(req.params).forEach(function (key) {
        if (req.params[key]) {
          if (!request.parameterMap[key]) {
            request.parameterMap[key] = new Array(req.params[key].toString());
            requestManager.setRequest(segment.transaction.id, request);
          }
        }
      });
    }
    if (req.query && request) {
      Object.keys(req.query).forEach(function (key) {
        if (req.query[key]) {
          if (!request.parameterMap[key]) {
            request.parameterMap[key] = new Array(req.query[key].toString());
            requestManager.setRequest(segment.transaction.id, request);
          }
        }
      });
    }
    if (req.route && req.route.path && request) {
      request.uri = req.route.path;
      requestManager.setRequest(segment.transaction.id, request);
    }
  }
}