/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'
const requestManager = require("../../core/request-manager");
const API = require("../../../nr-security-api");
const logger = API.getLogger();

const semver = require('semver')

module.exports = function initialize(shim, nextjs) {
  const nextVersion = shim.require('./package.json').version
  logger.info("Instrumenting nextjs", nextVersion);

  const nextServer = nextjs.default;
  hookRunAPI(shim, nextServer.prototype, nextVersion);
}

/**
 * Wrapper for Server.prototype.runApi
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} nextVersion 
 */
function hookRunAPI(shim, mod, nextVersion) {
  shim.wrap(mod, 'runApi', function wrapRunApi(shim, originalFn) {
    if (!shim.isFunction(originalFn)) {
      return originalFn
    }
    logger.debug("Instrumenting Server.prototype.runApi");
    return function wrappedRunApi() {
      try {
        const { page, params } = extractAttrs(arguments, nextVersion)
        extractParams(shim, page, params);
      } catch (error) {
        logger.debug("Error while processing path paramters");
      }

      return originalFn.apply(this, arguments)
    }
  })
}

/**
 * Extracts the page and params from an API request
 *
 * @param {object} args arguments to runApi
 * @param {string} version next.js version
 * @returns {object} { page, params }
 */
function extractAttrs(args, version) {
  let params
  let page
  if (semver.gte(version, '13.4.13')) {
    const [, , , match] = args
    page = match?.definition?.pathname
    params = { ...match?.params }
  } else {
    ;[, , , params, page] = args
  }

  return { params, page }
}

/**
 * Utility to extract path params
 * @param {*} page 
 * @param {*} params 
 */
function extractParams(shim, page, params) {
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
      if (request && page) {
        request.uri = page;
        requestManager.setRequest(transaction.id, request);
      }
    }
  } catch (error) {
  }
}

