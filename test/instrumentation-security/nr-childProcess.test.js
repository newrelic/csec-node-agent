/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

'use strict'

const test = require('tap').test;
const cp = require('child_process');
const utils = require('@newrelic/test-utilities')

test('child_process', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;
    let expectedUsername = require('os').userInfo().username;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/native/nr-childProcess');
        initialize(shim, cp, 'child_process');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('exec', (t) => {
        cp.exec('whoami', function (err, stdout, stderr) {
            t.equal(1, shim.interceptedArgs.length)
            t.equal('whoami', shim.interceptedArgs[0])
            t.notOk(err, 'should not throw error')
            let username = stdout.replace('\n', '');
            t.same(username, expectedUsername);
            t.end();
        })
    })

    t.test('spawn', (t) => {
        const cmd = cp.spawn('whoami');
        cmd.stdout.on('data', (data) => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal('whoami', shim.interceptedArgs[0])
            let username = data.toString().replace('\n', '');
            t.same(username, expectedUsername);
            t.end();
        });
    })

    t.test('execFile', (t) => {
        cp.execFile('whoami', (err, stdout, stderr) => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal('whoami', shim.interceptedArgs[0])
            t.notOk(err, 'should not error')
            let username = stdout.replace('\n', '');
            t.same(username, expectedUsername);
            t.end();
        });
    })

    t.test('spawnSync', (t) => {
        let username = cp.spawnSync('whoami').stdout.toString();
        t.equal(1, shim.interceptedArgs.length)
        t.equal('whoami', shim.interceptedArgs[0])
        username = username.replace('\n', '');
        t.same(username, expectedUsername);
        t.end();
    })
})

