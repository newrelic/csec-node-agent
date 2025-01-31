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
        let result = vm.runInThisContext(eval(2 + 2));
        t.equal(1, shim.interceptedArgs.length)
        t.equal(4, shim.interceptedArgs[0])
        t.equal(4, result)
        t.end();
    })
    t.test('runInNewContext', (t) => {
        // The code to be executed
        const code = 'a + b';

        // The context in which to run the code
        const context = {
            a: 5,
            b: 10
        };

        // Execute the code in the new context
        const result = vm.runInNewContext(code, context);
        t.equal(1, shim.interceptedArgs.length)
        t.equal('a + b', shim.interceptedArgs[0])
        t.equal(15, result)
        t.end();
    })

    t.test('runInContext', (t) => {

        // Create a context object
        const context = {
            x: 2,
            y: 3,
            sum: undefined
        };

        // Create a new VM context with the context object
        const scriptContext = vm.createContext(context);

        // Code to run
        const code = `sum = x + y;`;

        // Run the code inside the VM context
        vm.runInContext(code, scriptContext);

        t.equal(1, shim.interceptedArgs.length)
        t.equal('sum = x + y;', shim.interceptedArgs[0])
        t.equal(5, context.sum)
        t.end();
    })

})
