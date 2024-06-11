/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

'use strict'

const test = require('tap').test;
const vm = require('vm');
const utils = require('@newrelic/test-utilities')

test('vm', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/native/nr-vm');
        initialize(shim, vm, 'vm');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('runInThisContext', (t) => {
        let result = vm.runInThisContext(eval(2+2));
        t.equal(1, shim.interceptedArgs.length)
        t.equal(4, shim.interceptedArgs[0])
        t.equal(4, result)
        t.end();
    })
    t.test('runInNewContext', (t) => {
        let result = vm.runInThisContext(eval(22));
        t.equal(1, shim.interceptedArgs.length)
        t.equal(22, shim.interceptedArgs[0])
        t.equal(22, result)
        t.end();
    })

    t.test('runInContext', (t) => {
        let result = vm.runInThisContext(eval(2*4));
        t.equal(1, shim.interceptedArgs.length)
        t.equal(8, shim.interceptedArgs[0])
        t.equal(8, result)
        t.end();
    })

})

