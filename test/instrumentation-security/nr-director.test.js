/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */
'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities')
const sinon = require('sinon');
const director = require('director');
var http = require('http');

let server = null
const startDirectorServer = () => {
    function helloWorld() {
        this.res.writeHead(200, { 'Content-Type': 'text/plain' })
        this.res.end('Hello World!');
    }

    function test(name) {
        this.res.end('Hello ' + name);
    }
    var router = new director.http.Router({
        '/': {
            get: helloWorld
        },
        '/test': {
            '/:name': {
                get: test
            }
        }
    });
    server = http.createServer(function (req, res) {
        router.dispatch(req, res, function (err) {
            if (err) {
                res.writeHead(404);
                res.end();
            }
        });
    });

    server.listen(8081);
}

test('director', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.before(() => {
        startDirectorServer();
    })

    t.teardown(() => {
        server.close(function () {
            console.log('server is closed');
        });
    })

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/director/nr-director');
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        initialize(shim, director, 'director');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('createServer', (t) => {
        function test(name) {
            this.res.end('Hello ' + name);
        }

        var router = new director.http.Router({
            '/': {
                '/:name': {
                    get: test
                }
            }
        });
        var server2 = http.createServer(function (req, res) {
            router.dispatch(req, res, function (err) {
                if (err) {
                    res.writeHead(404);
                    res.end();
                }
            });
        });

        server2.listen(8082);
        server2.close(() => {
            console.log("server close")
            t.end()
        })
    })

    t.test('extractParams - params', (t) => {
        var request = require('request');
        var options = {
            'method': 'GET',
            'url': 'http://localhost:8081/test/john',
            'headers': {}
        };
        request(options, function (error, response) {
            t.same(response.statusCode, 200);
            t.same(response.body, "Hello john")
            t.end();
        });
    })
})