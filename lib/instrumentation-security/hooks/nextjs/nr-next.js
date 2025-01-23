/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'
const requestManager = require("../../core/request-manager");
const API = require("../../../nr-security-api");
const routeManager = require('../../core/route-manager');
const logger = API.getLogger();
const  lodash = require('lodash');
const { ATTHERATE, DOUBLE_DOLLAR, EMPTY_STR } = require('../../core/constants');

const fs = require('fs');
const path = require('path');

module.exports = function initialize(shim, nextjs) {
  const pkgVersion = shim.require('package.json').version;
  logger.info("Instrumenting nextjs", pkgVersion);

  //TODO need to update for API endpoints
  try {
    const appRoot = process.env.PWD;
    const searchPath = appRoot + '/.next/server/pages/api';
    const allAPIEndpoints = getAllAPIEndpoints(searchPath);
    logger.debug("allAPIEndpoints:", allAPIEndpoints);
    for (let index = 0; index < allAPIEndpoints.length; index++) {
      const element = allAPIEndpoints[index];
      let key = "*" + ATTHERATE + element;
      routeManager.setRoute(key, EMPTY_STR);
    }
  } catch (error) {
    logger.debug("Error while getting all API end points for next.js", error);
  }

  const utils = shim.require('./dist/next-server/lib/router/utils');

  if (utils) {
    getRouteMatcherHook(utils);
  }

  const routeMatcher = shim.require('./dist/shared/lib/router/utils/route-matcher.js');

  if (routeMatcher) {
    getRouteMatcherHook(routeMatcher);
  }

  /**
   * wrapper for route-matcher.getRouteMatcher
   * @param {*} mod 
   */
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
   * Utility to extract path params
   * @param {*} obj 
   * @param {*} params 
   */
  function extractParams(obj, params) {
    try {
      const transaction = shim.tracer.getTransaction();
      if (transaction) {
        let request = requestManager.getRequestFromId(transaction.id);
        Object.keys(params).forEach(function (key) {
          if (params[key]) {
            if (!request.parameterMap[key]) {
              request.parameterMap[key] = new Array(params[key].toString());
              requestManager.setRequest(transaction.id, request);
            }
          }
        });
        if (request && obj && obj.page) {
          request.uri = obj.page;
          requestManager.setRequest(transaction.id, request);
        }

      }
    } catch (error) {
    }
  }

}

/**
 * Utility to scan pages directory to get all avaible routes
 * @param {*} dir 
 * @returns 
 */
const getAllAPIEndpoints = (dir) => {
  logger.debug("dir is:", dir)
  const apiEndpoints = [];

  const scanDirectory = (currentDir) => {
    logger.debug("currentDir is:", currentDir)
    const files = fs.readdirSync(currentDir);

    files.forEach((file) => {
      const filePath = path.join(currentDir, file);
      const isDirectory = fs.statSync(filePath).isDirectory();

      if (isDirectory) {
        scanDirectory(filePath);
      } else {
        const apiEndpoint = filePath.replace(`${dir}/`, '/api/').replace(/\.[^/.]+$/, '');
        apiEndpoints.push(apiEndpoint);
      }
    });
  };

  scanDirectory(dir);
  return apiEndpoints;
};




