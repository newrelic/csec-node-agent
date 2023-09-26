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
const logger = API.getLogger();




module.exports = function initialize(shim, nextjs, moduleName) {
  const pkgVersion = shim.require('package.json').version;
  logger.info("Instrumenting nextjs", nextjs, pkgVersion);

  let utils = shim.require('./dist/next-server/lib/router/utils');
  console.log('utils is:', utils);

  let dest = shim.require('./dist/next-server/lib/router/utils/prepare-destination');
  console.log('dest is:', dest, dest.getSafeParamName);

  let router = shim.require('./dist/next-server/lib/router/router');
  console.log("router is:",router);

  let nextServer = shim.require('./dist/next-server/server/next-server');
  let Server = nextServer.default;
  console.log('nextServer is:', Server);


  shim.wrap(utils, 'isDynamicRoute', function wrapParam(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
    return function wrappedParam() {
      const route = fn.apply(this, arguments)
      console.trace("args:", arguments)
      return route
    }
  })

  shim.wrap(utils, 'getSortedRoutes', function wrapParam(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
    return function wrappedParam() {
      const route = fn.apply(this, arguments)
      console.log("args1:", arguments)
      return route
    }
  })

  

 



  

  




 
}
