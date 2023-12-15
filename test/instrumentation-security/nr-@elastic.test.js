/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities')
var elastic = require('@elastic/elasticsearch');
const Mock = require('@elastic/elasticsearch-mock')
const mock = new Mock();

const getElasticClient = () => {
    var elasticClient = new elastic.Client({
        node: 'http://localhost:9200',
        Connection: mock.getConnection()
    });

    mock.add({
        method: 'GET',
        path: '/'
    }, () => {
        return { status: 'ok' }
    })

    mock.add({
        method: 'PUT',
        path: '/:index'
    }, () => {
        return { status: 'index created' }
    })

    mock.add({
        method: 'POST',
        path: '/:index/_search'
    }, () => {
        return { status: 'index found' }
    })

    mock.add({
        method: 'GET',
        path: '/:index/_analyze'
    }, () => {
        return { status: 'ok' }
    })

    mock.add({
        method: 'POST',
        path: '/_bulk'
    }, () => {
        return { status: 'ok' }
    })

    return elasticClient;
}

test('elasticsearch', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;
    let client = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        client = getElasticClient();
        initialize = require('../../lib/instrumentation-security/hooks/@elastic/nr-@elastic');
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        sinon.stub(shim, 'require').returns({ version: '8.10.0' });
        initialize(shim, elastic, '@elastic/elasticsearch');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('connection', async (t) => {
        const res = await client.info()
        t.equal(res.status, 'ok')
        t.end();
    })

    t.test('create index', async (t) => {
        const res = await client.indices.create({
            index: "test"
        })
        t.same(res.status, 'index created')
        t.end();
    })

    t.test('search', async (t) => {
        const res = await client.search({
			index: "test",
			type: "docType",
			body: {explain: true},
            ignore_unavailable: true
		})
        t.same(res.status, 'index found')
        t.end();
    })

    t.test('analyze', async (t) => {
        const res = await client.indices.analyze({ index: "test" })
        t.same(res.status, 'ok')
        t.end();
    })

    t.test('bulk', async (t) => {
        const res = await client.bulk({
            body: [
              { delete: { _index: 'test', _type: 'test', _id: 33 } },
            ]
          }
        );
        t.same(res.status, 'ok')
        t.end();
    })

    t.test('unsupported version', async (t) => {
        sinon.restore()
        sinon.stub(shim, 'require').returns({ version: '6.0.0' });
        initialize(shim, elastic, '@elastic/elasticsearch');
        t.end();
    })
})