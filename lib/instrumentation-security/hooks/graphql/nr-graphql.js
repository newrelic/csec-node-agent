/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

'use strict'

/**
 * Express middleware generates traces where middleware are considered siblings
 * (ended on 'next' invocation) and not nested. Middlware are nested below the
 * routers they are mounted to.
 */

const requestManager = require("../../core/request-manager");
const { ATTHERATE, DOUBLE_DOLLAR } = require('../../core/constants');
const API = require("../../../nr-security-api");
const logger = API.getLogger();
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const { STRING, APPLICATION_JSON } = require('../../core/constants');

module.exports = function initialize(shim, mod) {
  logger.info("Instrumenting graphql");

  shim.wrap(mod, 'execute', function wrapExecute(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn;
    }
    return function wrappedExecute() {
      const segment = shim.getActiveSegment();
      try {
        if (segment && segment.transaction) {
          let request = requestManager.getRequestFromId(segment.transaction.id);
          let customDataType = {};
          if (request.headers['content-type'] === APPLICATION_JSON) {
            const requestBody = JSON.parse(request.body);
            
            if (requestBody.query) {
              customDataType['*.query'] = 'GRAPHQL_QUERY';
            }
            if (requestBody.variables) {
              customDataType['*.variables'] = 'GRAPHQL_VARIABLE';
            }
            request.customDataType = customDataType;
            requestManager.setRequest(segment.transaction.id, request);
          }
        }

      } catch (error) {
        logger.debug("Error while processing graphql http request", error);
      }

      return fn.apply(this, arguments);
    }
  })
}

