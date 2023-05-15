/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const API = require("../../../../nr-security-api");
const logger = API.getLogger();

const { getExport, wrapPostClientConstructor, wrapReturn } = require('./util')
const { dynamoMiddleware } = require('./dynamodb-util')

const CLIENT = 'DynamoDBDocumentClient'

const postClientConstructor = wrapPostClientConstructor(getPlugin)
const wrappedReturn = wrapReturn(postClientConstructor)

module.exports = function instrument(shim, name, resolvedName) {
  const ddbDocClientExport = getExport(shim, resolvedName, CLIENT)
  if (!shim.isFunction(ddbDocClientExport[CLIENT])) {
    logger.debug(`Could not find ${CLIENT}, not instrumenting.`)
  } else {
    logger.info(`Instrumenting ${name}`);
    shim.wrapReturn(ddbDocClientExport, CLIENT, wrappedReturn)
    shim.wrapReturn(ddbDocClientExport[CLIENT], 'from', wrappedReturn)
  }
}

/**
 * Returns the plugin object that adds an initialize middleware
 *
 * @param {Shim} shim
 * @param {Object} config DynamoDBDocumentClient config
 */
function getPlugin(shim, config) {
  return {
    applyToStack: (clientStack) => {
      clientStack.add(dynamoMiddleware.bind(null, shim, config), {
        name: 'NewRelicSecurityDynamoDocClientMiddleware',
        step: 'initialize',
        priority: 'low'
      })
    }
  }
}
