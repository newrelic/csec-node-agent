/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const tap = require('tap');
const test = tap.test;
const utils = require('@newrelic/test-utilities')
const redis = require('redis');
const { RedisMemoryServer } = require('redis-memory-server');
const redisServer = new RedisMemoryServer();

let client;

const dbSetup = async () => {
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    console.log("redis server running on:", host + ":" + port)
    client = redis.createClient(port, host);
    client.on('error', function (err) {
        console.error('redis error event - ' + client.host + ':' + client.port + ' - ' + err);
    });
}

test('redis', (t) => {
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
        initialize = require('../../lib/instrumentation-security/hooks/redis/nr-redis');
        initialize(shim, redis, 'redis');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('scan', (t) => {
        scan();
        t.equal('scan', shim.interceptedArgs.payloadType);
        t.equal(5, shim.interceptedArgs.payload.length);
        t.equal(0, shim.interceptedArgs.payload[0]);
        t.equal("MATCH", shim.interceptedArgs.payload[1]);
        t.end();
    })

    t.test('set', (t) => {
        client.set('string_key', 'string_val', redis.print);
        t.equal('set', shim.interceptedArgs.payloadType);
        t.equal(2, shim.interceptedArgs.payload.length);
        t.equal('string_key', shim.interceptedArgs.payload[0]);
        t.equal('string_val', shim.interceptedArgs.payload[1]);
        t.end();
    })

    t.test('hset', (t) => {
        client.hset('hash_key', 'hashtest', 'some_value', redis.print);
        t.equal('hset', shim.interceptedArgs.payloadType);
        t.equal(3, shim.interceptedArgs.payload.length);
        t.equal('hash_key', shim.interceptedArgs.payload[0]);
        t.equal('hashtest', shim.interceptedArgs.payload[1]);
        t.end();
    })

    t.test('hset_list', (t) => {
        client.hset(['hash_key', 'hashtest', 'some other value'], redis.print);
        t.equal('hset', shim.interceptedArgs.payloadType);
        t.equal(3, shim.interceptedArgs.payload.length);
        t.equal('hash_key', shim.interceptedArgs.payload[0]);
        t.equal('hashtest', shim.interceptedArgs.payload[1]);
        t.end();
    })

    t.test('sadd', (t) => {
        client.sadd('mylist', 1);
        t.equal('sadd', shim.interceptedArgs.payloadType);
        t.equal(2, shim.interceptedArgs.payload.length);
        t.equal('mylist', shim.interceptedArgs.payload[0]);
        t.equal(1, shim.interceptedArgs.payload[1]);
        t.end();
    })

    t.test('sort', (t) => {
        client.sort('mylist', 'by', 'weight_*', 'get', 'object_*', redis.print);
        t.equal('sort', shim.interceptedArgs.payloadType);
        t.equal(5, shim.interceptedArgs.payload.length);
        t.equal('mylist', shim.interceptedArgs.payload[0]);
        t.equal('by', shim.interceptedArgs.payload[1]);
        t.end();
    })

    t.test('mget', (t) => {
        client.mget(['sessions started', 'sessions started', 'foo'], function (err, res) {
        });
        t.equal('mget', shim.interceptedArgs.payloadType);
        t.equal(3, shim.interceptedArgs.payload.length);
        t.equal('sessions started', shim.interceptedArgs.payload[0]);
        t.equal('sessions started', shim.interceptedArgs.payload[1]);
        t.end();
    })

    t.test('mset', (t) => {
        client.mset('foo', 100, 'bar', 1, redis.print);
        t.equal('mset', shim.interceptedArgs.payloadType);
        t.equal(4, shim.interceptedArgs.payload.length);
        t.equal('foo', shim.interceptedArgs.payload[0]);
        t.equal(100, shim.interceptedArgs.payload[1]);
        t.end();
    })

    t.test('get', (t) => {
        client.get('foo', redis.print); // 100
        t.equal('get', shim.interceptedArgs.payloadType);
        t.equal(1, shim.interceptedArgs.payload.length);
        t.equal('foo', shim.interceptedArgs.payload[0]);
        t.end();
    })


    t.teardown(() => {
        process.exit(0)
    })


})

function scan() {
    client.scan(
        0,
        'MATCH', 'q:job:*',
        'COUNT', '10',
        function (err, res) {
            if (err) throw err;
            cursor = res[0];
            if (cursor === '0') {
                return console.log('Iteration complete');
            }
            if (res[1].length > 0) {
                console.log('Array of matching keys', res[1]);
            }
            return scan();
        }
    );
}
