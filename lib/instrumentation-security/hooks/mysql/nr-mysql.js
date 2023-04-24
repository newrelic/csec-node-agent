const requestManager = require("../../core/request-manager");

const async_hooks = require("async_hooks");
const secUtils = require('../../core/sec-utils');
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');
const logger = API.getLogger();

module.exports = initialize;

/**
 * Entry point of mysql and msyql2 module hooks
 * @param {*} shim 
 * @param {*} mysql 
 * @param {*} moduleName 
 */
function initialize(shim, mysql, moduleName) {
  logger.info("Instrumenting", moduleName);
  if (shim._moduleRoot.includes("mysql2")) {
    promiseInitialize(shim, mysql, moduleName);
  } else {
    callbackInitialize(shim, mysql, moduleName);
  }
}

/**
 * Wrapper for mysql module hooks
 * @param {*} shim 
 * @param {*} mysql 
 * @param {*} moduleName 
 */
function callbackInitialize(shim, mysql, moduleName) {
  shim.__wrappedPoolConnection = false;

  shim.wrapReturn(mysql, "createConnection", wrapCreateConnection);
  function wrapCreateConnection(shim, fn, fnName, connection) {
    if (wrapQueryable(shim, connection, false)) {
      const connProto = Object.getPrototypeOf(connection);
      shim.unwrap(mysql, "createConnection");
    }
  }

  shim.wrapReturn(mysql, "createPool", wrapCreatePool);
  function wrapCreatePool(shim, fn, fnName, pool) {
    if (wrapQueryable(shim, pool, true) && wrapGetConnection(shim, pool)) {
      shim.unwrap(mysql, "createPool");
    }
  }

  shim.wrapReturn(mysql, "createPoolCluster", wrapCreatePoolCluster);
  function wrapCreatePoolCluster(shim, fn, fnName, poolCluster) {
    const proto = Object.getPrototypeOf(poolCluster);
    shim.wrapReturn(proto, "of", wrapPoolClusterOf);
    function wrapPoolClusterOf(shim, of, _n, poolNamespace) {
      if (wrapGetConnection(shim, poolNamespace)) {
        shim.unwrap(proto, "of");
      }
    }
    if (wrapGetConnection(shim, poolCluster)) {
      shim.unwrap(mysql, "createPoolCluster");
    }
  }
}

/**
 * Wrapper for mysql2 module hooks
 * @param {*} shim 
 */
function promiseInitialize(shim) {
  const callbackAPI = shim.require("./index");
  if (callbackAPI && !shim.isWrapped(callbackAPI.createConnection)) {
    callbackInitialize(shim, callbackAPI);
  }
}

/**
 * Wrapper to hook connection obejct.
 * @param {*} shim 
 * @param {*} connectable 
 * @returns 
 */
function wrapGetConnection(shim, connectable) {
  if (
    !connectable ||
    !connectable.getConnection ||
    shim.isWrapped(connectable.getConnection)
  ) {
    return false;
  }

  const proto = Object.getPrototypeOf(connectable);
  shim.wrap(proto, "getConnection", function doWrapGetConnection(shim, fn) {
    return function wrappedGetConnection() {
      const args = shim.toArray(arguments);
      const cbIdx = args.length - 1;

      if (shim.isFunction(args[cbIdx]) && !shim.isWrapped(args[cbIdx])) {
        let cb = args[cbIdx];
        if (!shim.__wrappedPoolConnection) {
          cb = shim.wrap(cb, wrapGetConnectionCallback);
        }
        args[cbIdx] = shim.bindSegment(cb);
      }
      return fn.apply(this, args);
    };
  });

  return true;
}

function wrapGetConnectionCallback(shim, cb) {
  return function wrappedGetConnectionCallback(err, conn) {
    try {
      if (!err && wrapQueryable(shim, conn, false)) {
        // Leave getConnection wrapped in order to maintain TX state, but we can
        // simplify the wrapping of its callback in future calls.
        shim.__wrappedPoolConnection = true;
      }
    } catch (_err) { }
    return cb.apply(this, arguments);
  };
}

/**
 * Wrapper to hook query function.
 * @param {*} shim 
 * @param {*} queryable 
 * @param {*} isPoolQuery 
 * @returns 
 */
function wrapQueryable(shim, queryable, isPoolQuery) {
  if (!queryable || !queryable.query || shim.isWrapped(queryable.query)) {
    return false;
  }
  const proto = Object.getPrototypeOf(queryable);
  queryHook(shim, proto, "query", isPoolQuery);
  if (queryable.execute) {
    queryHook(shim, proto, "execute", isPoolQuery);
  }
  return true;
}

/**
 * Utility to extract query from the intercepted args
 * @param {*} shim 
 * @param {*} args 
 * @returns 
 */
function extractQueryArgs(shim, args) {
  let rawQuery = "";
  let param = [];

  // Figure out the query parameter.
  if (shim.isString(args[0])) {
    // query(sql [, values], callback)
    rawQuery = args[0];
  } else {
    // query(opts [, values], callback)
    rawQuery = args[0].sql;
  }
  // Then determine the query values and callback parameters.
  if (shim.isArray(args[1])) {
    // query({opts|sql}, values, callback)
    param = args[1];
  }
  else if (args[1] && typeof args[1] == 'object') {
    param = args[1];
    param =  Object.values(param)
  }
  return {
    rawQuery: rawQuery,
    param: param,
  };
}
/**
 * Wrapper to wrap query function.
 * @param {*} shim 
 * @param {*} mod 
 * @param {*} method 
 */
function queryHook(shim, mod, method, isPoolQuery) {

  shim.wrap(mod, method, function makeQueryWrapper(shim, fn) {
    return function queryWrapper() {
      const parameters = extractQueryArgs(shim, arguments);
      shim.interceptedArgs = parameters;
      const request = requestManager.getRequest(shim);
      if (request && !isPoolQuery) {
        const traceObject = secUtils.getTraceObject(shim);
        traceObject.sourceMethod = method;
        const secMetadata = securityMetaData.getSecurityMetaData(request, parameters, traceObject, secUtils.getExecutionId(), EVENT_TYPE.DB_COMMAND, EVENT_CATEGORY.MYSQL)
        const secEvent = API.generateSecEvent(secMetadata);
        API.sendEvent(secEvent);
        if (request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
          callbackHook(shim, arguments, arguments.length - 1, secEvent);
        }
      }
      return fn.apply(this, arguments);
    };
  });
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
      if ((arguments[0] === null || arguments[0] === undefined) && shim.secEvent) {
        API.generateExitEvent(shim.secEvent);
        delete shim.secEvent;
      }
      return fn.apply(this, arguments);
    }
  })
}