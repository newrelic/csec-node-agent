/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

module.exports = initialize
const requestManager = require('../../core/request-manager');
const secUtils = require("../../core/sec-utils");
const API = require("../../../nr-security-api");
const lodash = require('lodash');
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const { NR_CSEC_FUZZ_REQUEST_ID, QUESTION_MARK, EMPTY_STRING, COLON } = require('../../core/constants');
const NRCSECTRACINGDATA = 'NR-CSEC-TRACING-DATA';
const DOUBLE_SLASH = '//';
const logger = API.getLogger();
const url = require('url');


/**
 * Entry point undici module instrumentation.
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} moduleName 
 */
function initialize(shim, mod, moduleName) {
  logger.info('Instrumenting ' + moduleName, mod.Dispatcher.prototype);
  requestHooks(shim, mod && mod.Dispatcher && mod.Dispatcher.prototype, "request");
  requestHooks(shim, mod && mod.Dispatcher && mod.Dispatcher.prototype, "stream");
  requestHooks(shim, mod && mod.Dispatcher && mod.Dispatcher.prototype, "connect");
  requestHooks(shim, mod && mod.Dispatcher && mod.Dispatcher.prototype, "pipeline");
  requestHooks(shim, mod && mod.Dispatcher && mod.Dispatcher.prototype, "upgrade");
  fetchHook(shim, mod, "fetch");



}
/**
 * wrapper to hook undici request
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} methodName 
 */
function requestHooks(shim, mod, methodName) {
  shim.wrap(mod, methodName, function makeWrapper(shim, fn) {
    return function wrapper() {
      const request = requestManager.getRequest(shim);
      try {
        let allSymbolObjects = Object.getOwnPropertySymbols(this);
        let index = 0;
        for (let i = 0; i < allSymbolObjects.length; i++) {
          const element = allSymbolObjects[i].toString();
          index = i;
          if (element === 'Symbol(url)') {
            break;
          }
        }
        let URLObject = this[Object.getOwnPropertySymbols(this)[index]];
        const data = {};
        data.headers = {};
        if (methodName === 'request') {
          data.method = arguments[0].method;
          data.path = arguments[0].path;
        }
        else if (methodName === 'stream') {
          data.method = arguments[1].method;
          data.path = arguments[0];
        }

        data.protocol = URLObject.protocol ? URLObject.protocol : 'http:';
        data.headers.host = URLObject.host ? URLObject.host : URLObject.hostname;

        let completeURL = data.protocol + DOUBLE_SLASH + data.headers.host + (data.port ? (COLON + data.port) : EMPTY_STRING) + data.path;
        completeURL = completeURL.split(QUESTION_MARK)[0];

        if (request && !lodash.isEmpty(data.headers.host) && !lodash.isEmpty(data.path)) {
          const appUUID = API.getSecAgent().applicationInfo.applicationUUID;
          const traceObject = secUtils.getTraceObject(shim);
          const secMetadata = securityMetaData.getSecurityMetaData(request, data, traceObject, secUtils.getExecutionId(), EVENT_TYPE.HTTP_REQUEST, EVENT_CATEGORY.HTTP)
          this.secEvent = API.generateSecEvent(secMetadata);
          API.sendEvent(this.secEvent);

          let traceHeader = EMPTY_STRING;
          if (request.headers['nr-csec-tracing-data']) {
            traceHeader = request.headers['nr-csec-tracing-data'];
          }

          if (methodName === 'request') {
            if (arguments[0] instanceof Object) {
              if (arguments[0] && arguments[0].headers && request.headers) {
                arguments[0].headers[NRCSECTRACINGDATA] = traceHeader + appUUID + '/' + this.secEvent.apiId + '/' + this.secEvent.id + ';';
              } else {
                arguments[0].headers = {};
                arguments[0].headers[NRCSECTRACINGDATA] = traceHeader + appUUID + '/' + this.secEvent.apiId + '/' + this.secEvent.id + ';';
              }
              if (request && request.headers[NR_CSEC_FUZZ_REQUEST_ID] && arguments[0].headers) {
                arguments[0].headers[NR_CSEC_FUZZ_REQUEST_ID] = request.headers[NR_CSEC_FUZZ_REQUEST_ID];
              }
            }
          }
          else if (methodName === 'stream') {
            if (arguments[1] instanceof Object) {
              if (arguments[1] && arguments[1].headers && request.headers) {
                arguments[1].headers[NRCSECTRACINGDATA] = traceHeader + appUUID + '/' + this.secEvent.apiId + '/' + this.secEvent.id + ';';
              } else {
                arguments[1].headers = {};
                arguments[1].headers[NRCSECTRACINGDATA] = traceHeader + appUUID + '/' + this.secEvent.apiId + '/' + this.secEvent.id + ';';
              }
              if (request && request.headers[NR_CSEC_FUZZ_REQUEST_ID] && arguments[1].headers) {
                arguments[1].headers[NR_CSEC_FUZZ_REQUEST_ID] = request.headers[NR_CSEC_FUZZ_REQUEST_ID];
              }
            }
          }
        }
      } catch (error) {

      }

      const result = fn.apply(this, arguments);

      if (result && request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
        API.generateExitEvent(this.secEvent);
        delete this.secEvent
      }
      return result;
    }
  })
}
/**
 * Wrapper to hook undici.fetch()
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} methodName 
 */
function fetchHook(shim, mod, methodName) {
  shim.wrap(mod, methodName, function makeWrapper(shim, fn) {
    return function wrapper() {
      const request = requestManager.getRequest(shim);
      try {
        const completeURL = arguments[0];
        const parsedUrl = url.parse(completeURL);
        const data = {};
        data.headers = {};
        data.method = arguments[0].method ? arguments[0].method : EMPTY_STRING;
        data.path = parsedUrl.pathname ? parsedUrl.pathname : parsedUrl.path;
        data.protocol = parsedUrl.protocol;
        data.headers.host = parsedUrl.host ? parsedUrl.host : parsedUrl.hostname;
        data.port = parsedUrl.port ? parsedUrl.port : parsedUrl.port;


        if (request && !lodash.isEmpty(data.headers.host) && !lodash.isEmpty(data.path)) {
          const appUUID = API.getSecAgent().applicationInfo.applicationUUID;
          const traceObject = secUtils.getTraceObject(shim);
          const secMetadata = securityMetaData.getSecurityMetaData(request, data, traceObject, secUtils.getExecutionId(), EVENT_TYPE.HTTP_REQUEST, EVENT_CATEGORY.HTTP)
          this.secEvent = API.generateSecEvent(secMetadata);
          API.sendEvent(this.secEvent);

          let traceHeader = EMPTY_STRING;
          if (request.headers['nr-csec-tracing-data']) {
            traceHeader = request.headers['nr-csec-tracing-data'];
          }

          if (arguments[1] instanceof Object) {
            if (arguments[1] && arguments[1].headers && request.headers) {
              arguments[1].headers[NRCSECTRACINGDATA] = traceHeader + appUUID + '/' + this.secEvent.apiId + '/' + this.secEvent.id + ';';
            } else {
              arguments[1].headers = {};
              arguments[1].headers[NRCSECTRACINGDATA] = traceHeader + appUUID + '/' + this.secEvent.apiId + '/' + this.secEvent.id + ';';
            }
            if (request && request.headers[NR_CSEC_FUZZ_REQUEST_ID] && arguments[1].headers) {
              arguments[1].headers[NR_CSEC_FUZZ_REQUEST_ID] = request.headers[NR_CSEC_FUZZ_REQUEST_ID];
            }
          }
        }
      } catch (error) {
      }
      const result = fn.apply(this, arguments);

      if (result && request && request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
        API.generateExitEvent(this.secEvent);
        delete this.secEvent
      }
      return result;
    }
  })
}

