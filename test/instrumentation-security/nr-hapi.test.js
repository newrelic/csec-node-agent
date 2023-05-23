/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities')
const Hapi = require('@hapi/hapi');

let server;

const closeServer = async () => {

    server.stop({ timeout: 10 * 1000 }, () => {
        console.log('Shutting down server')
        process.exit(0)
    })
};

test('hapi', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/hapi/nr-hapi');
        initialize(shim, Hapi, 'hapi');
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('server start', async (t) => {
        server = Hapi.server({
            port: 3002,
            host: 'localhost'
        });

        await server.start();
        closeServer();
        t.end();
    })

    t.test('hapi - null', (t) => {
        initialize(shim, null, 'hapi');
        t.end();
    })

    t.test('route', async (t) => {
        server = Hapi.server({
            port: 3002,
            host: 'localhost'
        });

        server.route({
            method: 'GET',
            path: '/',
            handler: (request, h) => {
                return 'Hello World!';
            }
        });

        await server.start();
        closeServer()
        t.end();
    })

    t.test('route - array', async (t) => {
        server = Hapi.server({
            port: 3002,
            host: 'localhost'
        });

        server.route([{
            method: 'GET',
            path: '/',
            handler: (request, reply) => {
                reply('Hello World!');
            }
        }]);

        await server.start();
        closeServer()
        t.end();
    })
})