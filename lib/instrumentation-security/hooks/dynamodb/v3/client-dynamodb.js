/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'


const API = require("../../../../nr-security-api");
const logger = API.getLogger();

const { getExport, wrapPostClientConstructor, wrapReturn } = require('./util')
const { dynamoMiddleware } = require('./dynamodb-util')

const CLIENT = 'DynamoDBClient'

const postClientConstructor = wrapPostClientConstructor(getPlugin)
const wrappedReturn = wrapReturn(postClientConstructor)

module.exports = function instrument(shim, name, resolvedName) {
  const dynamoClientExport = getExport(shim, resolvedName, CLIENT)
  const dynamoDBVersion = shim.require("./package.json").version;
  logger.debug(`${name} version:`,dynamoDBVersion)
  if (!shim.isFunction(dynamoClientExport[CLIENT])) {
    logger.debug(`Could not find ${CLIENT}, not instrumenting.`)
  } else {
    logger.info(`Instrumenting ${name}`);
    shim.wrapReturn(dynamoClientExport, CLIENT, wrappedReturn)
  }
}

/**
 * Returns the plugin object that adds middleware
 *
 * @param {Shim} shim
 * @returns {object}
 */
function getPlugin(shim, config) {
  return {
    applyToStack: (clientStack) => {
      clientStack.add(dynamoMiddleware.bind(null, shim, config), {
        name: 'NewRelicSecurityDynamoMiddleware',
        step: 'initialize',
        priority: 'low'
      })
    }
  }
}
