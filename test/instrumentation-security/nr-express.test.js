/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities');


const mockExpress = () => {
    return {
        get: (path, callback) => {
            return { status: 200 };
        },
        listen: (port) => {
            console.log('Mock server started on port:', port);
        },
        Router: () => { },
        use: () => {
            console.log('use called');
        }
    };
}

const mockRouter = () => {
    return {
        use: () => { },
        route: () => { }
    }
}

test('express', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;
    const app = mockExpress();
    app.Router = mockRouter;
    app.Router.use = () => { };
    app.Router.route = () => { };
    app.Router.process_params = () => { };

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/express/nr-express');
        initialize(shim, app, 'express');
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
    })

    t.afterEach(() => {
        helper && helper.unload();
    })

    t.test('listen', (t) => {
        app.listen(8080);
        t.end();
    })

    t.test('route', (t) => {
        const router = app.Router()
        router.use(() => { })
        app.Router.route("/test");
        app.listen(8080);
        t.end();
    })

    t.test('process_params', (t) => {
        const router = app.Router()
        router.use(() => { })
        const request = {
            params: { foo: "bar" },
            query: "foo=bar"
        }
        app.Router.process_params("param1", "param2", request);
        app.listen(8080);
        t.end();
    })

    t.test('get', (t) => {
        app.get("/test", (req, res) => {
            res.send("hello")
        });
        app.use("parser")
        app.listen(8080);
        t.end();
    })
})