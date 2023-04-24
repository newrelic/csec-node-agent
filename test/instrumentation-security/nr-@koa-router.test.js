/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities');
const sinon = require('sinon');
const request = require('request');

const Koa = require('koa');
const app = new Koa();
const Router = require('@koa/router');
const router = new Router()
let server = null

const startKoaServer = () => {
    router.get('/hello', (ctx, next) => {
        ctx.body = 'Hello World';
        next()
    });

    router.get('/user/:name', (ctx, next) => {
        console.log(ctx.params)
        ctx.body = 'Hello ' + ctx.params.name;
        next()
    });
    app.use(router.routes())
    server = app.listen(3000);
}

test('koa', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.before(() => {
        startKoaServer();
    })

    t.teardown(() => {
        server.close(() => {
            console.log('server is closed');
        });
    })

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented();
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/koa/@koa/nr-@koa-router');
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        initialize(shim, Router, '@koa/router');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('route', (t) => {
        const app2 = new Koa()
        const router2 = new Router()

        router2.get('/hello', (ctx, next) => {
            ctx.body = 'Hello World';
            next()
        });

        app2.use(router2.routes())
        const server2 = app2.listen(3001);
        server2.close(t.end())
    })

    t.test('paramHook', (t) => {
        var options = {
            'method': 'GET',
            'url': 'http://localhost:3000/hello',
            'headers': {}
        };
        request(options, function (error, response) {
            t.notOk(error, 'should not throw any error')
            t.same(response.statusCode, 200);
            t.end();
        });
    })

    t.test('paramHook_query', (t) => {
        const url = 'http://localhost:3000/hello?test=foo'
        var options = {
            'method': 'GET',
            'url': url,
            'headers': {}
        };
        request(options, function (error, response) {
            t.notOk(error, 'should not throw any error')
            t.same(response.statusCode, 200);
            t.end();
        });
    })

    t.test('paramHook_params', (t) => {
        var options = {
            'method': 'GET',
            'url': 'http://localhost:3000/user/John',
            'headers': {}
        };
        request(options, function (error, response) {
            t.notOk(error, 'should not throw any error')
            t.same(response.statusCode, 200);
            console.log(response.body)
            t.end();
        });
    })
})