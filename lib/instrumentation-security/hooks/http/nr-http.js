/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

module.exports = initialize
const requestManager = require('../../core/request-manager');
const { NR_CSEC_FUZZ_REQUEST_ID, QUESTION_MARK, EMPTY_STRING, UTF8, CONTENT_TYPE, TEXT_HTML, APPLICATION_JSON, APPLICATION_XML, APPLICATION_XHTML, TEXT_PLAIN, APPLICATION_X_FORM_URLENCODED, MULTIPART_FORM_DATA } = require('../../core/constants');
const ARRAY_TYPE = 'Array';
const STRING_TYPE = 'string';
const BUFFER_TYPE = 'Buffer';
const UINT8ARRAY_TYPE = 'Uint8Array';
const OBJECT_TYPE = 'object'
const unescapeJs = require('unescape-js');
const ConType = require('content-type');
const lodash = require('lodash');
const URL = require('url')
const secUtils = require('../../core/sec-utils');
const API = require("../../../nr-security-api");
const logger = API.getLogger();
const NRAgent = API.getNRAgent();
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const hc = require('../../../nr-security-agent/lib/core/health-check');

const NRCSECTRACINGDATA = 'NR-CSEC-TRACING-DATA';
const SELFTEST = 'self-test';

const requestIp = require('request-ip');
const isInvalid = require('is-invalid-path');
const path = require('path');
const fs = require('fs');
const semver = require('semver');


const CSEC_SEP = ':IAST:';
const find = '{{NR_CSEC_VALIDATOR_HOME_TMP}}';
const CSEC_HOME_TMP_CONST = new RegExp(find, 'g');
let CSEC_HOME = NRAgent && NRAgent.config.newrelic_home ? NRAgent.config.newrelic_home : NRAgent && NRAgent.config.logging.filepath ? path.dirname(NRAgent.config.logging.filepath) : require('path').join(process.cwd());
const CSEC_HOME_TMP = `${CSEC_HOME}/nr-security-home/tmp/language-agent/${process.env.applicationUUID}`

/**
 * Entry point of http module hook
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} moduleName 
 */
function initialize(shim, mod, moduleName) {
  logger.info('Instrumenting HTTP module');
  emitHook(shim, mod, moduleName);
  createServerHook(shim, mod, moduleName);
  outboundHook(shim, mod, 'request', moduleName);
  if (semver.gte(process.version, '8.0.0')) {
    outboundHook(shim, mod, 'get', moduleName);
  }
  setupRequestMapCleanup()
}

/**
 * Adds a listener for when a transaction finishes
 * so the request manager map entry can be cleaned up
 */
function setupRequestMapCleanup() {
  if (NRAgent) {
    NRAgent.on('transactionFinished', function onTransactionFinished(transaction) {
      const requestData = requestManager.getRequestFromId(transaction.id);
      if (requestData && requestData.tempFiles && !lodash.isEmpty(requestData.tempFiles)) {
        const tempFiles = requestData.tempFiles;
        for (let i = 0; i < tempFiles.length; i++) {
          const file = tempFiles[i];
          deleteTempFileForIAST(file);
        }
      }
      // Here removing request data corresponding to transactionId
      setTimeout(() => {
        requestManager.gcRequestMap(transaction);
      }, 5000);
    })
  }
}


/**
 * Hook to intercept outbound http requests.
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} moduleName 
 */
function outboundHook(shim, mod, method, moduleName) {
  shim.wrap(mod, method, function makeRequestWrapper(shim, fn) {
    return function requestWrapper() {
      const request = requestManager.getRequest(shim);
      const data = {};
      data.headers = {};
      data.method = arguments[0].method;
      data.path = arguments[0].path;
      data.protocol = arguments[0].protocol ? arguments[0].protocol : 'http:';
      data.headers.host = arguments[0].hostname ? arguments[0].hostname : arguments[0].host;
      data.port = arguments[0].port;
      if (method === 'get') {
        data.method = 'GET';
        data.path = '/';
        data.headers.host = arguments[0];
        try {
          data.headers.host = data.headers.host.replace(/(^\w+:|^)\/\//, '');
        } catch (error) {

        }
      }
      let completeURL = data.protocol + '//' + data.headers.host + (data.port ? (':' + data.port) : '') + data.path;
      completeURL = completeURL.split(QUESTION_MARK)[0];

      if (request && !lodash.isEmpty(data.headers.host) && !lodash.isEmpty(data.path)) {
        const appUUID = API.getSecAgent().applicationInfo.applicationUUID;
        const id = secUtils.getExecutionId().toString();
        let generateFlag = false;
        if (arguments[0] && arguments[0].headers && arguments[0].headers.SECHOOK === id) {
          generateFlag = true;
        }
        if (!generateFlag) {
          const traceObject = secUtils.getTraceObject(shim);
          const secMetadata = securityMetaData.getSecurityMetaData(request, data, traceObject, secUtils.getExecutionId(), EVENT_TYPE.HTTP_REQUEST, EVENT_CATEGORY.HTTP)
          this.secEvent = API.generateSecEvent(secMetadata);
          API.sendEvent(this.secEvent);
          if (request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
            callbackHook(shim, arguments, arguments.length - 1, this.secEvent);
          }
        }

        let traceHeader = EMPTY_STRING;
        if (request.headers['nr-csec-tracing-data']) {
          traceHeader = request.headers['nr-csec-tracing-data'];
        }

        if (arguments[0] instanceof Object) {
          if (arguments[0] && arguments[0].headers && request.headers) {
            arguments[0].headers.SECHOOK = id;
            arguments[0].headers[NRCSECTRACINGDATA] = traceHeader + appUUID + '/' + this.secEvent.apiId + '/' + this.secEvent.id + ';';
          } else {
            arguments[0].headers = {};
            arguments[0].headers[NRCSECTRACINGDATA] = traceHeader + appUUID + '/' + this.secEvent.apiId + '/' + this.secEvent.id + ';';
            arguments[0].headers.SECHOOK = id;
          }
          if (request && request.headers[NR_CSEC_FUZZ_REQUEST_ID] && arguments[0].headers) {
            arguments[0].headers[NR_CSEC_FUZZ_REQUEST_ID] = request.headers[NR_CSEC_FUZZ_REQUEST_ID];
          }
        }
      }
      return fn.apply(this, arguments);
    };
  });
}

/**
 * Function to parse fuzzheaders and create temp files in case of dynamic scanning
 * Not functional
 * @param {*} fuzzheaders 
 */
function parseFuzzheaders(requestData, transactionId) {
  let fuzzheaders = requestData.headers;
  const policy = API.getPolicy();
  const dynamicScanningFlag = policy.data ? policy.data.vulnerabilityScan.iastScan.enabled : false;
  if (fuzzheaders[NR_CSEC_FUZZ_REQUEST_ID] && dynamicScanningFlag) {
    try {
      const additionalData = fuzzheaders[NR_CSEC_FUZZ_REQUEST_ID].split(CSEC_SEP);
      logger.debug('AdditionalData:', additionalData);
      if (additionalData.length >= 7) {
        for (let i = 6; i < additionalData.length; i++) {
          let file = additionalData[i].trim();
          file = file.replace(CSEC_HOME_TMP_CONST, CSEC_HOME_TMP);
          file = path.resolve(file);
          const parentDir = path.dirname(file);
          if (!isInvalid(parentDir) && isPathInside(parentDir, CSEC_HOME_TMP)) {
            try {
              if (!fs.existsSync(parentDir)) {
                secUtils.createPathIfNotExist(parentDir);
              } else {
                logger.debug(parentDir + ' Already Exists');
              }
              fs.closeSync(fs.openSync(file, 'w'));

              requestData.tempFiles = [];
              requestData.tempFiles.push(file);
              requestManager.setRequest(transactionId, requestData);

            } catch (error) {
              logger.debug(error);
            }
          }
        }
      }
    } catch (error) {
      logger.debug(error);
    }
  }
}

/**
 * Utility function to add request data in a Map
 * @param {*} shim 
 * @param {*} request 
 * @param {*} resp 
 */
function addRequestData(shim, request) {
  try {
    const data = Object.assign({});
    const segment = shim.getActiveSegment();
    if (segment && segment.transaction) {
      data.body = null;
      data.headers = request.headers;
      data.url = request.url;
      data.method = request.method;
      data.httpVersion = request.httpVersion;
      data.serverPort = segment.transaction.port;
      data.contextPath = '/';
      const queryObject = URL.parse(request.url, true).query;
      data.parameterMap = {};
      if (queryObject) {
        Object.keys(queryObject).forEach(function (key) {
          if (queryObject[key]) {
            if (!data.parameterMap[key]) {
              data.parameterMap[key] = new Array(queryObject[key].toString());
            }
          }
        });
      }
      data.clientIP = requestIp.getClientIp(request);
      const transactionId = segment.transaction.id;
      const storedRequest = requestManager.getRequestFromId(transactionId);
      if (storedRequest && storedRequest.uri) {
        data.uri = storedRequest.uri;
        data.parameterMap = storedRequest.parameterMap;
      }
      requestManager.setRequest(transactionId, data);
      if (shim.agent.getLinkingMetadata()) {
        let linkingMetadata = shim.agent.getLinkingMetadata();
        if (linkingMetadata['trace.id']) {
          let traceId = linkingMetadata['trace.id'];
          requestManager.setRequest(traceId, data)
        }
      }
      parseFuzzheaders(data, transactionId);
    }
  } catch (error) {
    logger.debug("Error while preparing incoming request:", error);
  }

}

/**
 * Wrappert to hook http.server.emit() 
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} moduleName 
 */
function emitHook(shim, mod, moduleName) {
  shim.wrap(mod && mod.Server && mod.Server.prototype, 'emit', function makeEmitWrapper(shim, fn) {
    return function emitWrapper() {
      const req = arguments[1];
      const resp = arguments[2];

      if (arguments[0] == 'request') {
        if (NRAgent && NRAgent.config.security.detection.rxss.enabled) {
          responseHook(resp, req, shim);
        }

        shim.wrap(req, 'on', function makeOnWrapper(shim, fn) {
          return function OnWrapper() {
            if (!requestManager.getRequest(shim)) {
              addRequestData(shim, req);
            }
            if (arguments[0] === 'end') {
              if (req && req.headers[SELFTEST] != 1) {
                hc.getInstance().registerHttpRequestCount();
              }
            }
            if (arguments[0] === 'data') {
              onDataHook(shim, arguments)
            }
            return fn.apply(this, arguments);
          }
        })
      }

      return fn.apply(this, arguments);
    }
  })
}

/**
 * Wrapper for http.createServer method
 * @param {*} shim 
 * @param {*} mod 
 */
function createServerHook(shim, mod) {
  shim.wrap(mod, 'createServer', function createServerWrapper(shim, fn) {
    return function wrappedCreateServer() {
      shim.wrap(arguments, '0', function appWrapper(shim, fn) {
        return function wrappedApp() {
          let req = arguments[0];
          if (!requestManager.getRequest(shim)) {
            addRequestData(shim, req);
          }
          return fn.apply(this, arguments);
        }
      })
      return fn.apply(this, arguments);
    }
  })
}

/**
 * Wrapper to hook http request body 
 * @param {*} shim 
 * @param {*} mod 
 */
function onDataHook(shim, mod) {
  shim.wrap(mod, '1', function makeOnDataWrapper(shim, fn) {
    return function onDataWrapper() {
      const chunk = arguments[0];
      const chunkType = typeof chunk;
      segment = shim.getActiveSegment()
      if (chunkType === STRING_TYPE || chunkType === ARRAY_TYPE || chunkType === BUFFER_TYPE || chunkType === UINT8ARRAY_TYPE || chunkType === OBJECT_TYPE) {
        let data = chunk.toString();
        const transactionId = segment.transaction.id;
        const requestData = requestManager.getRequestFromId(transactionId);
        if (requestData) {
          data = requestData.body ? requestData.body.concat(chunk.toString()) : chunk.toString();
          requestManager.updateRequestBody(shim, data);
        }

      }
      return fn.apply(this, arguments);
    }
  })
}

/**
 * Wrapper to hook response.write() and reponse.end() method 
 * @param {*} resp 
 * @param {*} req 
 * @param {*} shim 
 */
function responseHook(resp, req, shim) {
  // wrapper for response.write() 
  resp.res = {};
  resp.res.body = EMPTY_STRING;

  shim.wrap(resp, 'write', function makeWriteWrapper(shim, fn) {
    return function wrappedWrite() {
      const response = this;
      responseBodyCompute(response, arguments);
      return fn.apply(this, arguments);
    }
  })
  // wrapper for response.end() 
  shim.wrap(resp, 'end', function makeEndWrapper(shim, fn) {
    return function wrappedEnd() {
      const response = this;
      responseBodyCompute(response, arguments);
      const request = requestManager.getRequest(shim);
      const construct = API.checkForReflectedXSS(request, response.res.body, response.getHeaders());
      const policy = API.getPolicy();
      const dynamicScanningFlag = policy.data ? (policy.data.vulnerabilityScan?.enabled && policy.data.vulnerabilityScan.iastScan.enabled) : false;
      if (request && (construct || dynamicScanningFlag)) {
        const args = [];
        args.push(construct);
        args.push(response.res.body);
        const traceObject = secUtils.getTraceObject(shim);
        const secMetadata = securityMetaData.getSecurityMetaData(request, args, traceObject, secUtils.getExecutionId(), EVENT_TYPE.REFLECTED_XSS, EVENT_CATEGORY.REFLECTED_XSS)
        const secEvent = API.generateSecEvent(secMetadata);

        API.sendEvent(secEvent);
      }
      return fn.apply(this, arguments);
    }
  })
}

function responseBodyCompute(response, args) {
  let encoding = UTF8;
  const type = response.getHeader(CONTENT_TYPE);
  let contentType = TEXT_HTML;
  if (type) {
    const obj = ConType.parse(type);
    contentType = obj.type;
    encoding = obj.parameters.charset;
  }
  if (args[0]) {
    switch (contentType) {
      case APPLICATION_JSON:
        response.res.body += unescapeJs(args[0].toString(encoding));
        break;
      case APPLICATION_XML:
      case APPLICATION_XHTML:
      case TEXT_PLAIN:
      case TEXT_HTML:
      case APPLICATION_X_FORM_URLENCODED:
      case MULTIPART_FORM_DATA: {
        const data = args[0].toString(encoding);
        response.res.body += data;
        break;
      }
    }
  }
}

/**
 * Callback hook to generate exit event
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} fun 
 * @param {*} secEvent 
 */
function callbackHook(shim, mod, fun, secEvent) {
  shim.secEvent = secEvent;
  shim.wrap(mod, fun, function callbackWrapper(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn;
    }
    return function wrapper() {
      if (arguments && shim.secEvent) {
        API.generateExitEvent(shim.secEvent);
        delete shim.secEvent;
      }
      return fn.apply(this, arguments);
    }
  })
}

/**
 * Utility to check if child path is inside parent path
 * @param {*} childPath 
 * @param {*} parentPath 
 * @returns 
 */
function isPathInside(childPath, parentPath) {
  childPath = path.resolve(childPath);
  parentPath = path.resolve(parentPath);

  if (childPath === parentPath) {
    return false;
  }

  childPath += path.sep;
  parentPath += path.sep;

  return childPath.startsWith(parentPath);
}


/**
 * Delete Temporary file for IAST. Do not call this in RASP
 * @param {*} file 
 */
function deleteTempFileForIAST(file) {
  try {
    if (fs.existsSync(file)) {
      logger.debug("Deleting temporary file:", file);
      fs.unlinkSync(file);
    }
  } catch (error) {
    logger.debug("Unable to delete temporary file", error);
  }
}