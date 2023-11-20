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
        let args = arguments[0];
        let extractedReq = queryParser(args);
        let payloadData = {
          payload: extractedReq.query,
          payloadType: extractedReq.operation,
          collection: extractedReq.collection
        }
        shim.interceptedArgs = payloadData;
        const request = requestManager.getRequest(shim);
        if (request) {
          const traceObject = secUtils.getTraceObject(shim);
          const secMetadata = securityMetaData.getSecurityMetaData(request, payloadData, traceObject, secUtils.getExecutionId(), EVENT_TYPE.NOSQL_DB_COMMAND, EVENT_CATEGORY.ELASTIC_SEARCH)
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

/**
 * Convenience function to test if a value is a non-null object
 *
 * @param {object} thing Value to be tested
 * @returns {boolean} whether or not the value is an object and not null
 */
function isSimpleObject(thing) {
  return Object.prototype.toString.call(thing) === '[object Object]' && thing !== null
}

/**
 * Convenience function to test if an object is not empty
 *
 * @param {object} thing Value to be tested
 * @returns {boolean} true if the value is an object, not null, and has keys
 */
function isNotEmpty(thing) {
  return isSimpleObject(thing) && Object.keys(thing).length > 0
}

/**
 * Parses the parameters sent to elasticsearch for collection,
 * method, and query
 *
 * @param {object} params Query object received by the datashim.
 * Required properties: path {string}, method {string}.
 * Optional properties: querystring {string}, body {object}, and
 * bulkBody {object}
 * @returns {object} consisting of collection {string}, operation {string},
 * and query {string}
 */
function queryParser(params) {
  const { collection, operation } = parsePath(params.path, params.method)

  // the substance of the query may be in querystring or in body.
  let queryParam = {}
  if (isNotEmpty(params.querystring)) {
    queryParam = params.querystring
  }
  // let body or bulkBody override querystring, as some requests have both
  if (isNotEmpty(params.body)) {
    queryParam = params.body
  } else if (Array.isArray(params.bulkBody) && params.bulkBody.length) {
    queryParam = params.bulkBody
  }
  
  const query = queryParam;
  return {
    collection,
    operation,
    query,
  }
}


/**
 * Convenience function for parsing the params.path sent to the queryParser
 * for normalized collection and operation
 *
 * @param {string} pathString params.path supplied to the query parser
 * @param {string} method http method called by @elastic/elasticsearch
 * @returns {object} consisting of collection {string} and operation {string}
 */
function parsePath(pathString, method) {
  let collection
  let operation
  const defaultCollection = 'any'
  const actions = {
    GET: 'get',
    PUT: 'create',
    POST: 'create',
    DELETE: 'delete',
    HEAD: 'exists'
  }
  const suffix = actions[method]

  try {
    const path = pathString.split('/')
    if (method === 'PUT' && path.length === 2) {
      collection = path?.[1] || defaultCollection
      operation = `index.create`
      return { collection, operation }
    }
    path.forEach((segment, idx) => {
      const prev = idx - 1
      let opname
      if (segment === '_search') {
        collection = path?.[prev] || defaultCollection
        operation = `search`
      } else if (segment[0] === '_') {
        opname = segment.substring(1)
        collection = path?.[prev] || defaultCollection
        operation = `${opname}.${suffix}`
      }
    })
    if (!operation && !collection) {
      // likely creating an index--no underscore segments
      collection = path?.[1] || defaultCollection
      operation = `index.${suffix}`
    }
  } catch (e) {
    logger.warn('Failed to parse path for operation and collection. Using defaults')
    logger.warn(e)
    collection = defaultCollection
    operation = 'unknown'
  }

  return { collection, operation }
}

