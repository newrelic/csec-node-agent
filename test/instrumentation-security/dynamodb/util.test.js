/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities');
const clientDynamoDb = require("@aws-sdk/client-dynamodb")
const { getExport, wrapPostClientConstructor } = require("../../../lib/instrumentation-security/hooks/dynamodb/v3/util");

test('dynamodb - util', (t) => {
    t.autoend();
    let helper = null;
    let shim = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
    })

    t.afterEach(() => {
        helper && helper.unload();
    })

    t.test('getExport', async (t) => {
        sinon.stub(shim, 'require').returns(clientDynamoDb)
        const response = getExport(shim, '@aws-sdk/lib-dynamodb', 'DynamoDBClient');
        t.equal(response, clientDynamoDb);
    })
})