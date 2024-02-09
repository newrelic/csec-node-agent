/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities');

function getMockModule() {
    class RouterExplorer { }
    RouterExplorer.prototype.applyCallbackToRouter = sinon.stub()
    return { RouterExplorer }
}

function getMockModuleWithoutFunction() {
    class RouterExplorer { }
    RouterExplorer.prototype.applyCallbackToRouter = "test"
    return { RouterExplorer }
}

test('nestjs', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;
    let mockCore = null;

    t.beforeEach(async () => {
        helper = utils.TestAgent.makeInstrumented()
        initialize = require('../../lib/instrumentation-security/hooks/@nestjs/nr-nestjs-core');
        shim = helper.getShim()
        mockCore = getMockModule();
    })

    t.afterEach(() => {
        helper && helper.unload();
    })

    t.test('supported version', async (t) => {
        const requireStub = sinon.stub(shim, 'require');
        requireStub.returns({ version: '8.1.0' });
        requireStub.onSecondCall().returns(mockCore);
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        initialize(shim, mockCore, '@nestjs/core');
        helper.runInTransaction((tx) => {
            var routerExplorer = new mockCore.RouterExplorer()
            routerExplorer.applyCallbackToRouter("Route", { path: "/test", requestMethod: "GET"}, "testWrapper", "moduleKey", {ctrlPath: '/'})
            tx.end()
            t.equal(
                shim.getOriginal(routerExplorer.applyCallbackToRouter).callCount,
                1,
                'should have called the original applyCallbackToRouter once'
            )
        })
        t.end();
    })

    t.test('when path is not correct', async (t) => {
        const requireStub = sinon.stub(shim, 'require');
        requireStub.returns({ version: '8.1.0' });
        requireStub.onSecondCall().returns(mockCore);
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        initialize(shim, mockCore, '@nestjs/core');
        helper.runInTransaction((tx) => {
            var routerExplorer = new mockCore.RouterExplorer()
            routerExplorer.applyCallbackToRouter("Route", { path: "abc", requestMethod: "GET"}, "testWrapper", "moduleKey", {ctrlPath: '/'})
            tx.end()
            t.equal(
                shim.getOriginal(routerExplorer.applyCallbackToRouter).callCount,
                1,
                'should have called the original applyCallbackToRouter once'
            )
        })
        t.end();
    })

    t.test('when applyCallbackToRouter is not a function', async (t) => {
        const requireStub = sinon.stub(shim, 'require');
        requireStub.returns({ version: '8.1.0' });
        requireStub.onSecondCall().returns(getMockModuleWithoutFunction());
        initialize(shim, mockCore, '@nestjs/core');
        t.end();
    })

    t.test('unsupported version', (t) => {
        sinon.restore()
        sinon.stub(shim, 'require').returns({ version: '7.0.0' });
        initialize(shim, mockCore, '@nestjs/core');
        t.end();
    })
})