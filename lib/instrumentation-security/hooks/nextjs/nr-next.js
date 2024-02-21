/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'
const requestManager = require("../../core/request-manager");
const API = require("../../../nr-security-api");
const logger = API.getLogger();

const fs = require('fs');
const path = require('path');

module.exports = function initialize(shim, nextjs) {
  const pkgVersion = shim.require('package.json').version;
  logger.info("Instrumenting nextjs", pkgVersion);

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

/**
 * Utility to scan pages directory to get all avaible routes
 * @param {*} dir 
 * @returns 
 */
const getAllAPIEndpoints = (dir) => {
  const apiEndpoints = [];

  const scanDirectory = (currentDir) => {
    const files = fs.readdirSync(currentDir);

    files.forEach((file) => {
      const filePath = path.join(currentDir, file);
      const isDirectory = fs.statSync(filePath).isDirectory();

      if (isDirectory) {
        scanDirectory(filePath);
      } else {
        const apiEndpoint = filePath.replace(`${dir}/`, '/').replace(/\.js$/, '');
        apiEndpoints.push(apiEndpoint);
      }
    });
  };

  scanDirectory(dir);
  return apiEndpoints;
};



try {
  const appRoot = API.getSecAgent().applicationInfo.serverInfo.deployedApplications[0].deployedPath;
  const searchPath = appRoot + '/.next/server/pages';
  const allAPIEndpoints = getAllAPIEndpoints(searchPath);
} catch (error) {
  logger.debug("Error while getting all API end points for next.js", error);
}

