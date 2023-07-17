module.exports = initialize;
const requestManager = require("../../core/request-manager");
const secUtils = require("../../core/sec-utils");
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');
const logger = API.getLogger();
const semver = require('semver')
let serverAddress;


function initialize(shim, grpc, moduleName) {
  logger.info('Instrumenting grpc', moduleName);
  const grpcVersion = shim.require('./package.json').version;
  logger.debug("grpc version:", grpcVersion);

  if (semver.lt(grpcVersion, '1.4.0')) {
    logger.debug('gRPC server-side instrumentation only supported on grpc-js >=1.4.0')
    return
  }

  const server = shim.require('./build/src/server')
  shim.wrap(server.Server.prototype, 'bindAsync', bindAsyncWrapper)
  shim.wrap(server.Server.prototype, 'register', wrapRegister)

}

function bindAsyncWrapper(shim, original) {
  return function wrappedbindAsync() {
    serverAddress = arguments[0];
    shim.grpcServerAddress = serverAddress;
    const result = original.apply(this, arguments);
    return result;
  }
}


/**
 * Instruments the grpc-js server by intercepting the moment when
 * server methods are registered from the method implementations
 * provided to grpc-js. This handles all four types of server
 * invocations: unary, client-streaming, server-streaming, and
 * bidirectional streaming.
 *
 * @param {object} shim the web shim to instrument with
 * @param {Function} original the original function
 * @returns {Function} the instrumented function
 */
function wrapRegister(shim, original) {
  return function wrappedRegister() {
    wrapHandler(shim, arguments, '1');
    const result = original.apply(this, arguments);
    return result;
  }
}


/**
 * Wrapper to hook handler function
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} method 
 */
function wrapHandler(shim, mod, method) {
  shim.wrap(mod, method, function wrapHandler(shim, fn) {
    return function wrappedHandler() {
      const type = this.type;
      const path = this.path;
      wrapCallback(shim, arguments, '1');
      addRequestData(shim, type, path, arguments[0]);
      const result = fn.apply(this, arguments);
      return result;

    }
  })
}

/**
 * Wrapper to hook callback response
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} method 
 */
function wrapCallback(shim, mod, method) {
  shim.wrap(mod, method, function wrapCallback(shim, fn) {
    return function wrappedCallback() {
      const response = arguments[1];
      const result = fn.apply(this, arguments);
      return result;

    }
  })
}

/**
 * Utility function to add grpc request data in request map
 * @param {*} shim 
 * @param {*} type 
 * @param {*} path 
 * @param {*} args 
 */
function addRequestData(shim, type, path, args) {
  const data = Object.assign({});
  try {
    const segment = shim.getActiveSegment();
    if (segment && segment.transaction) {
      data.method = path;
      data.url = path;
      data.headers = args.metadata.getMap();
      data.type = type
      data.isGRPC = true;
      data.body = args.request;
      data.serverPort = shim.grpcServerAddress
      const transactionId = segment.transaction.id;
      logger.error("data is:",data);
      requestManager.setRequest(transactionId, data);
    }
  } catch (error) {
    logger.error("Error occured while extracting grpc request");
  }
}