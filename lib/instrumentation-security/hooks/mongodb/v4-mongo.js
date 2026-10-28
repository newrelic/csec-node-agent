/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */


'use strict'

const { instrumentCollectionViaChannel, instrumentCursorViaChannel, instrumentDb } = require('./common')

module.exports = function instrument(shim, mongodb) {
  // The newrelic agent instruments mongodb (>= 4) via diagnostics_channel and
  // reassigns the driver prototype methods. Reassigning those same prototype
  // methods here would clobber the agent's instrumentation (and vice versa), so
  // we subscribe to the agent's construction channels and attach our security
  // wrapper to each constructed instance instead. A single `nr_cursor`
  // subscription covers AbstractCursor and its subclasses (FindCursor,
  // AggregationCursor). See https://github.com/newrelic/csec-node-agent/issues/374.
  //
  // If the agent does not expose those channels (older agent without
  // subscriber based mongodb instrumentation), these fall back to the legacy
  // prototype wrapping, which is safe because there is no colliding agent
  // instrumentation in that case.
  instrumentCursorViaChannel(shim, mongodb.AbstractCursor)
  instrumentCollectionViaChannel(shim, mongodb.Collection)
  instrumentDb(shim, mongodb.Db)
}
