/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities');
const Hapi = require('@hapi/hapi');
const undici = require('undici');
const {Writable} = require('stream');

let server;

const startServer = async () => {
    server = Hapi.server({
        port: 8010,
        host: 'localhost'
    });

    server.route([
        {
            method: 'GET',
            path: '/user',
            handler: (request, h) => {
                return "Hello " + request.query.name;
            }
        },
        {
            method: 'GET',
            path: '/user/{id}',
            handler: (request, h) => {
                return {"name": "Test User"};
            }
        }
    ]);

    await server.start();
    console.log('server listening at %s', server.info.uri);
}

test('undici', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.before(async () => {
        await startServer();
    })

    t.teardown(async () => {
        await server.stop();
        console.log('server is closed');
    })

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/undici/nr-undici');
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        initialize(shim, undici, 'undici');
    })

    t.afterEach(() => {
        helper && helper.unload();
    })

    t.test('request', async (t) => {
        const client = new undici.Client("http://localhost:8010");
        const response = await client.request({
            path: '/user/1',
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            }
          });
        t.same(response.statusCode, 200)
        t.end();
    })

    t.test('stream', async (t) => {
        const client = new undici.Client("http://localhost:8010");
        let bufs = []
        await client.stream({
            path: '/user?name=NR',
            method: "GET",
            opaque: { bufs }
          }, ({ statusCode, headers, opaque: { bufs } }) => {
            return new Writable({
                write (chunk, encoding, callback) {
                  bufs.push(chunk)
                  callback()
                }
              })
          })
        t.same(bufs.toString(), "Hello NR");
        t.end();
    })

    t.test('fetch', async (t) => {
        const response = await undici.fetch("http://localhost:8010/user/1");
        const data = await response.text()
        t.same(response.status, 200)
        t.ok(data)
        t.end();
    })
})