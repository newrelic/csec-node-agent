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
const { STRING } = require('../../core/constants');

module.exports = function initialize(shim, mod) {
  logger.info("Instrumenting graphql", mod);

  shim.wrap(mod, 'convertNodeHttpToRequest', function wrapConvertNodeHttpToRequest(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
    return function wrappedConvertNodeHttpToRequest() {
      const graphQlRequest = arguments[0];
      let customDataType = {};
      if (graphQlRequest && graphQlRequest.body) {
        if(graphQlRequest.body.query){
          customDataType['*.query'] = 'GRAPHQL_QUERY';
        }
        if(graphQlRequest.body.variables){
          customDataType['*.variables'] = 'GRAPHQL_VARIABLE';
        }
      }

      const segment = shim.getActiveSegment();
      if (segment && segment.transaction && customDataType) {
        let request = requestManager.getRequestFromId(segment.transaction.id);
        request.customDataType = customDataType;
        requestManager.setRequest(segment.transaction.id, request);
      }
      const result = fn.apply(this, arguments)
      return result;
    }
  })
}

