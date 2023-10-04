/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities')
const cp = require('child_process');
const Memcached = require('memcached');
let memcached = new Memcached();

const dbSetup = async () => {
    cp.execSync('docker rm -f csec_memcache && docker run --name csec_memcache -p 11212:11211 -d memcached && sleep 1');
    memcached = new Memcached("localhost:11212");
}

test('memcached', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.before(async () => {
        await dbSetup();
    })

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/memcached/nr-memcached');
        initialize(shim, Memcached, 'memcached', require('memcached/lib/utils'));
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('set', (t) => {
        memcached.set("hello", 1, 100, function (err, result) {
            t.equal('set', shim.interceptedArgs.type);
            t.equal('hello', shim.interceptedArgs.key);
            t.equal(1, shim.interceptedArgs.value);
            t.end();
        });
    })

    t.test('get', (t) => {
        memcached.get("hello", function (err, result) {
            t.equal('get', shim.interceptedArgs.type);
            t.equal('hello', shim.interceptedArgs.key);
            t.end();
        });
    })

    t.test('get_multi', (t) => {
        memcached.get(["hello", "hello_json"], function (err, result) {
            t.equal('get', shim.interceptedArgs.type);
            t.equal(2, shim.interceptedArgs.key.length);
            t.end();
        });
    })

    t.test('delete', (t) => {
        memcached.del('foo', function (err, result) {
            t.equal('delete', shim.interceptedArgs.type);
            t.equal('foo', shim.interceptedArgs.key);
            t.end();
        });
    })

    t.test('set_json', (t) => {
        memcached.set("hello_json", { javascript: 'objects', are: ['no', 'problem', 4], nMemcached: true }, 10000, function (err, result) {
            t.equal('set', shim.interceptedArgs.type);
            t.equal('hello_json', shim.interceptedArgs.key);
            t.equal("objects", shim.interceptedArgs.value.javascript);
            t.equal(true, shim.interceptedArgs.value.nMemcached);
            t.equal(3, shim.interceptedArgs.value.are.length);
            t.end();
        });
    })

    t.teardown(() => {
        cp.execSync('docker rm -f csec_memcache');
    })


})

