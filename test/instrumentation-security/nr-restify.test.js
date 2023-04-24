/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities')
const sinon = require('sinon');
const restify = require('restify');
const server = restify.createServer();

const startRestifyServer = () => {
    server.use(restify.plugins.acceptParser(server.acceptable));
    server.use(restify.plugins.queryParser());
    server.use(restify.plugins.bodyParser());
    server.get("/user", (req, res, next) => {
        res.send("Hello " + req.query.name);
        next();
    });
    server.del("/user/:id", (req, res, next) => {
        res.send("Deleted successfully");
        next();
    });
    server.listen(8000, function () {
        console.log('%s listening at %s', server.name, server.url);
    });
}

test('restify', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.before(() => {
        startRestifyServer();
    })

    t.teardown(() => {
        server.close(function () {
            console.log('server is closed');
        });
    })

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/restify/nr-restify');
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        initialize(shim, server, 'restify');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('createServer', (t) => {
        const app = restify.createServer();
        app.get("/test", (req, res, next) => {
            res.send("hello world");
            next();
        });
        app.listen(9000, () => {
            t.ok(true, 'server should start');
        })
        app.close(() => {
            t.ok(true, 'server should be closed');
            t.end()
        });
    })

    t.test('extractParams - query', (t) => {
        var request = require('request');
        var options = {
            'method': 'GET',
            'url': 'http://localhost:8000/user?name=Joe',
            'headers': {}
        };
        request(options, function (error, response) {
            t.notOk(error, 'should not throw any error')
            t.same(response.statusCode, 200);
            t.end();
        });
    })

    t.test('extractParams - params', (t) => {
        var request = require('request');
        var options = {
            'method': 'DELETE',
            'url': 'http://localhost:8000/user/1',
            'headers': {}
        };
        request(options, function (error, response) {
            t.notOk(error, 'should not throw any error')
            t.same(response.statusCode, 200);
            console.log(response.body)
            t.end();
        });
    })

    t.test('extractParams - setRequest', (t) => {
        var request = require('request');
        var options = {
            'method': 'DELETE',
            'url': 'http://localhost:8000/user/1',
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