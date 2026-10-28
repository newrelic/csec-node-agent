/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

"use strict";

/* eslint sonarjs/cognitive-complexity: ["error", 18] -- TODO: https://issues.newrelic.com/browse/NEWRELIC-5252 */

const diagnosticsChannel = require("diagnostics_channel");
const { CURSOR_OPS, COLLECTION_OPS, DB_OPS } = require("./constants");
const common = module.exports;
const requestManager = require("../../core/request-manager");
const async_hooks = require("async_hooks");
const secUtils = require("../../core/sec-utils");
const API = require("../../../nr-security-api");
const securityMetaData = require('../../core/security-metadata');
const { EVENT_TYPE, EVENT_CATEGORY } = require('../../core/event-constants');
const { NR_CSEC_FUZZ_REQUEST_ID } = require('../../core/constants');
const logger = API.getLogger();

// Prefix for the newrelic agent's mongodb tracing channels. The agent publishes
// one tracing channel per instrumented mongodb class; subscribing to these lets
// us attach to constructed instances without reassigning prototype methods.
const AGENT_MONGODB_CHANNEL_PREFIX = "orchestrion:mongodb:";
// Marks an instance whose methods we have already wrapped, so repeated channel
// events for the same object do not double-wrap.
const CSEC_MONGO_INSTANCE_HOOKED = Symbol("csecMongoInstanceHooked");
// Tracks the active subscription handlers per agent channel. The mongodb hook
// can run more than once in a process (e.g. the newrelic agent being unloaded
// and re-instrumented), each time with a fresh `shim`. The tracing channel is
// process-global, so on each run we must remove the previous subscription
// (bound to the old `shim`) before adding a new one, otherwise we stack
// duplicate subscribers that serve a stale `shim`.
//
// This registry must live on `globalThis`, not in a module-scoped variable:
// this file's path contains "mongodb", so test/require-cache busters that evict
// modules matching "mongodb" would reload this module and reset a module-scoped
// Map — losing the handle needed to unsubscribe the still-live prior
// subscription. Keyed by full channel name -> handlers object.
const CHANNEL_SUBSCRIPTIONS_KEY = Symbol.for("newrelic.csec.mongodb.channelSubscriptions");
const channelSubscriptions =
  globalThis[CHANNEL_SUBSCRIPTIONS_KEY] ||
  (globalThis[CHANNEL_SUBSCRIPTIONS_KEY] = new Map());

function methodChecker(data) {
  data = data.toLowerCase();
  if (data.includes("delete")) {
    return "delete";
  } else if (data.includes("update") || data.includes("replace")) {
    return "update";
  } else if (data.includes("insert") || data.includes("write")) {
    return "insert";
  } else if (data.includes("find")) {
    return "find";
  } else {
    return "Unknown";
  }
}

function payloadType(obj) {
  if (obj) {
    if (obj.insert) {
      return "insert";
    } else if (obj.update) {
      return "update";
    } else if (obj.delete) {
      return "delete";
    } else if (obj.find) {
      return "find";
    } else {
      return "Unknown";
    }
  }
  else{
    return "Unknown";
  }

}

/**
 * Builds the security wrapper for a mongodb operation. The returned function
 * reads the operation payload, generates the NoSQL security event, and (for
 * fuzz requests) hooks the callback, then delegates to the original method.
 *
 * This is shared by both attachment strategies: the legacy prototype wrap
 * (`queryHook`, used for mongodb < 4 where the newrelic agent does not provide
 * subscriber based instrumentation) and the per-instance attachment
 * (`instrumentInstance`, used for mongodb >= 4 so we do not reassign a
 * prototype method already instrumented by the newrelic agent).
 *
 * @param {Shim} shim
 * @param {string} method name of the operation being wrapped
 * @param {Function} fn the original method
 * @returns {Function} the wrapped method
 */
function makeQueryWrapper(shim, method, fn) {
  return function queryWrapper() {
    const request = requestManager.getRequest(shim);
    if (CURSOR_OPS.includes(method)) {
      if (!this.mongo_sec_hooked && this.operation && this.operation.cmd) {
        const pType = payloadType(this.operation.cmd);
        const payloadData = {
          payloadType: pType,
          payload: this.operation.cmd,
        };
        shim.interceptedArgs = payloadData;
      }
    } else {
      this.mongo_sec_hooked = true;

      const pType = methodChecker(method);
      const payloadData = {
        payloadType: pType,
        payload: arguments,
      };
      shim.interceptedArgs = payloadData;

    }

    try {
      if (request) {
        //generate event here
        const traceObject = secUtils.getTraceObject(shim);
        const secMetadata = securityMetaData.getSecurityMetaData(request, JSON.parse(JSON.stringify(shim.interceptedArgs)), traceObject, secUtils.getExecutionId(), EVENT_TYPE.NOSQL_DB_COMMAND, EVENT_CATEGORY.MONGO)
        const secEvent = API.generateSecEvent(secMetadata);
        API.sendEvent(secEvent);
        if (request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
          callbackHook(shim, arguments, arguments.length - 1, secEvent);
        }
      }
    } catch (error) {
    }


    return fn.apply(this, arguments);
  };
}

function queryHook(shim, mod, method) {
  shim.wrap(mod, method, function wrapQuery(shim, fn) {
    logger.debug(`Instrumenting mongodb.${method}`);
    return makeQueryWrapper(shim, method, fn);
  });
}

/**
 * Attaches the security wrapper to a single mongodb instance (a `Collection`,
 * cursor, etc.) as an own property, leaving the class prototype untouched.
 *
 * The newrelic agent (>= the release that instruments mongodb via
 * `diagnostics_channel`) reassigns the driver prototype methods. If we also
 * wrapped the prototype, the two reassignments would clobber one another and
 * the agent's datastore instrumentation would be lost. Wrapping the instance
 * sits below the prototype, so both coexist. See
 * https://github.com/newrelic/csec-node-agent/issues/374.
 *
 * @param {Shim} shim
 * @param {object} instance a constructed mongodb object (e.g. a `Collection`)
 * @param {string[]} methods operation names to wrap when present on `instance`
 */
function instrumentInstance(shim, instance, methods) {
  if (!instance || instance[CSEC_MONGO_INSTANCE_HOOKED]) {
    return;
  }
  // Guard so repeated channel events for the same instance do not re-wrap.
  Object.defineProperty(instance, CSEC_MONGO_INSTANCE_HOOKED, {
    value: true,
    enumerable: false,
    writable: true,
    configurable: true
  });

  for (let i = 0; i < methods.length; i++) {
    const method = methods[i];
    const fn = instance[method];
    if (typeof fn !== "function") {
      continue;
    }
    logger.debug(`Instrumenting mongodb instance method ${method}`);
    // Own property on the instance; does not touch the prototype. The
    // prototype method is resolved at call time, not captured here: this
    // subscriber can run before the newrelic agent has wrapped the prototype
    // (e.g. the agent was unloaded and re-created while our channel
    // subscription stayed registered), and capturing the raw method would
    // shadow the agent's later wrap and drop its datastore segment.
    instance[method] = makeQueryWrapper(shim, method, function protoMethod() {
      return Object.getPrototypeOf(this)[method].apply(this, arguments);
    });
  }
}

/**
 * Subscribes to a newrelic agent mongodb construction tracing channel and
 * attaches the security wrapper to each constructed instance. Returns false if
 * the agent does not expose the channel (e.g. an older agent without
 * subscriber based mongodb instrumentation), so callers can fall back to the
 * legacy prototype wrapping.
 *
 * @param {Shim} shim
 * @param {string} channelName the agent channel, e.g. `nr_collection`
 * @param {string[]} methods operation names to wrap on each instance
 * @returns {boolean} whether the channel subscription was established
 */
function subscribeToAgentChannel(shim, channelName, methods) {
  const fullName = `${AGENT_MONGODB_CHANNEL_PREFIX}${channelName}`;
  try {
    const channel = diagnosticsChannel.tracingChannel(fullName);
    // Only ride the agent's channel when the agent is actually instrumenting
    // mongodb on it (it subscribes its own handler via `start`). If nothing is
    // publishing here (e.g. an older newrelic agent without subscriber based
    // mongodb instrumentation, or the agent disabled), report failure so the
    // caller falls back to the legacy prototype wrapping. There is no colliding
    // agent instrumentation in that case, so prototype wrapping is safe.
    if (channel.start.hasSubscribers !== true) {
      return false;
    }
    // Remove any prior subscription for this channel. On re-instrumentation the
    // previous handlers closed over a now-stale `shim`; replacing them keeps a
    // single live subscription bound to the current `shim`.
    const previous = channelSubscriptions.get(fullName);
    if (previous) {
      channel.unsubscribe(previous);
    }
    const handlers = {
      end(event) {
        try {
          instrumentInstance(shim, event && event.self, methods);
        } catch (error) {
          logger.debug(`Error instrumenting mongodb instance via ${channelName}`, error);
        }
      }
    };
    channel.subscribe(handlers);
    channelSubscriptions.set(fullName, handlers);
    return true;
  } catch (error) {
    logger.debug(`Could not subscribe to agent channel ${channelName}`, error);
    return false;
  }
}

/**
 * Instruments cursor operations for mongodb >= 4 by subscribing to the newrelic
 * agent's cursor construction channel and attaching to each instance. Falls
 * back to the legacy prototype wrapping when the agent channel is unavailable.
 *
 * @param {Shim} shim
 * @param {Cursor} [Cursor] cursor class, used only for the fallback path
 */
common.instrumentCursorViaChannel = function instrumentCursorViaChannel(shim, Cursor) {
  const methods = CURSOR_OPS.concat(["each"]);
  const subscribed = subscribeToAgentChannel(shim, "nr_cursor", methods);
  if (!subscribed) {
    common.instrumentCursor(shim, Cursor);
  }
};

/**
 * Instruments collection operations for mongodb >= 4 by subscribing to the
 * newrelic agent's collection construction channel and attaching to each
 * instance. Falls back to the legacy prototype wrapping when the agent channel
 * is unavailable.
 *
 * @param {Shim} shim
 * @param {Collection} [Collection] collection class, used only for the fallback path
 */
common.instrumentCollectionViaChannel = function instrumentCollectionViaChannel(shim, Collection) {
  const subscribed = subscribeToAgentChannel(shim, "nr_collection", COLLECTION_OPS);
  if (!subscribed) {
    common.instrumentCollection(shim, Collection);
  }
};

/**
 * Instruments all methods from constants.CURSOR_OPS on a given
 * cursor class
 *
 * @param {Shim} shim
 * @param {Cursor} Cursor
 */
common.instrumentCursor = function instrumentCursor(shim, Cursor) {
  if (Cursor && Cursor.prototype) {
    const proto = Cursor.prototype;
    for (let i = 0; i < CURSOR_OPS.length; i++) {
      queryHook(shim, proto, CURSOR_OPS[i]);
    }
    queryHook(shim, proto, "each");
  }
};

/**
 * Instruments all methods from constants.COLLECTION_OPS on
 * the Collection class
 *
 * @param {Shim} shim
 * @param {Collection} Collection
 */
common.instrumentCollection = function instrumentCollection(shim, Collection) {
  if (Collection && Collection.prototype) {
    const proto = Collection.prototype;
    for (let i = 0; i < COLLECTION_OPS.length; i++) {
      queryHook(shim, proto, COLLECTION_OPS[i]);
    }
  }
};

/**
 * Instruments the execute method on
 * the BulkOperationBase class
 *
 * @param {Shim} shim
 * @param {BulkOperationModule} bulk operation module, typically from mongodb/lib/bulk/common
 * @param BulkOperationModule
 */
common.instrumentBulkOperation = function instrumentBulkOperation(
  shim,
  BulkOperationModule
) {
  const BulkOperationBase =
    BulkOperationModule && BulkOperationModule.BulkOperationBase;

  if (BulkOperationBase && BulkOperationBase.prototype) {
    const proto = BulkOperationBase.prototype;
    queryHook(shim, proto, "execute");
  }
};

/**
 * Instruments all methods from constants.DB_OPS on
 * the Db class.
 *
 * @param {object} params
 * @param {Shim} params.shim
 * @param {Db} params.Db
 * @param shim
 * @param Db
 */
common.instrumentDb = function instrumentDb(shim, Db) {
  if (Db && Db.prototype) {
    const proto = Db.prototype;
  }
  //here need to add hooks for DB ops
};

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

common.queryHookV2 = function queryHookV2(shim, mod, method) {
  shim.wrap(mod, method, function makeQueryWrapper(shim, fn) {
    logger.debug(`Instrumenting mongodb.${method}`);
    return function queryWrapper() {
      const request = requestManager.getRequest(shim);
      if (CURSOR_OPS.includes(method)) {
        if (!this.mongo_sec_hooked && this.cmd) {
          const pType = payloadType(this.cmd);
          const payloadData = {
            payloadType: pType,
            payload: this.cmd,
          };
          shim.interceptedArgs = payloadData;
        }
      } else {
        this.mongo_sec_hooked = true;

        const pType = methodChecker(method);
        const payloadData = {
          payloadType: pType,
          payload: arguments,
        };
        shim.interceptedArgs = payloadData;

      }

      if (request && shim.interceptedArgs) {
        //generate event here
        const traceObject = secUtils.getTraceObject(shim);
        const secMetadata = securityMetaData.getSecurityMetaData(request, JSON.parse(JSON.stringify(shim.interceptedArgs)), traceObject, secUtils.getExecutionId(), EVENT_TYPE.NOSQL_DB_COMMAND, EVENT_CATEGORY.MONGO)
        const secEvent = API.generateSecEvent(secMetadata);
        if (this.sec_executionId != secMetadata.executionId) {
          API.sendEvent(secEvent);
          this.sec_executionId = secMetadata.executionId;
        }

        if (request.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
          callbackHook(shim, arguments, arguments.length - 1, secEvent);
        }
      }
      return fn.apply(this, arguments);
    };
  });
}


