/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities')

test('postgres', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/postgres/nr-postgres');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    function getMockModule() {
        function PG(clientConstructor, poolConstructor) {
            this.Client = clientConstructor
            this.Pool = poolConstructor
        }

        function DefaultClient() { }
        DefaultClient.prototype.query = (query, callback) => {
            callback(null, "Query executed");
        }
        DefaultClient.prototype.connect = function () { }
        function NativeClient() { }
        NativeClient.prototype.query = function () { }
        NativeClient.prototype.connect = function () { }

        function Pool() { }
        Pool.prototype.query = function () { }

        const mockPg = new PG(DefaultClient, Pool)
        mockPg.__defineGetter__('native', function () {
            delete mockPg.native
            mockPg.native = new PG(NativeClient, Pool)
            return mockPg.native
        })
        return mockPg
    }

    t.test('Client', (t) => {
        const mockPg = getMockModule()
        initialize(shim, mockPg, 'pg')

        let pg = mockPg.native
        t.equal(pg.Client.name, 'NativeClient')

        pg = mockPg
        t.equal(pg.Client.name, 'DefaultClient')
        t.end()
    })

    t.test('Pool', (t) => {
        process.env.NODE_PG_FORCE_NATIVE = true;
        const mockPg = getMockModule()
        initialize(shim, mockPg, 'pg')

        const pool = new mockPg.Pool()
        pool.query('SELECT NOW()', (err, res) => {
            t.same(res, "Query executed")
        })
        t.end();
    })

    t.test('Native client - argument is object', (t) => {
        process.env.NODE_PG_FORCE_NATIVE = true;
        const mockPg = getMockModule()
        initialize(shim, mockPg, 'pg')

        const client = new mockPg.Client()
        const query = {
            text: 'SELECT NOW()',
            values: ['test1', 'test2']
        }
        client.query(query, (err, res) => {
            t.same(res, "Query executed")
        })
        t.end();
    })

    t.test('Native client - argument is not object', (t) => {
        process.env.NODE_PG_FORCE_NATIVE = true;
        const mockPg = getMockModule()
        initialize(shim, mockPg, 'pg')
        const client = new mockPg.Client()
        client.query('SELECT NOW()', (err, res) => {
            t.same(res, "Query executed")
        })
        t.end();
    })

    t.test('Native client - argument is of QueryStream', (t) => {
        process.env.NODE_PG_FORCE_NATIVE = true;
        const mockPg = getMockModule()
        initialize(shim, mockPg, 'pg')
        const client = new mockPg.Client()

        const query = {
            constructor: {
                name: 'QueryStream'
            },
            cursor: {
                text: 'SELECT NOW()',
                values: ['test1', 'test2']
            }
        }
        client.query(query, (err, res) => {
            t.same(res, "Query executed")
        })
        t.end();
    })
})