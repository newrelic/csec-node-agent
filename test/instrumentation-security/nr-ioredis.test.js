/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const tap = require('tap');
const test = tap.test;
const utils = require('@newrelic/test-utilities')
const Redis = require('ioredis')
let redis;
const { RedisMemoryServer } = require('redis-memory-server');
const redisServer = new RedisMemoryServer();


const dbSetup = async () => {
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    console.log("redis server running on:", host+":"+port)
    redis = new Redis(port, host);
    redis.on('error', (err) => {
        console.error("redis error:", err)
    })
}

test('ioredis', (t) => {
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
        initialize = require('../../lib/instrumentation-security/hooks/ioredis/nr-ioredis');
        initialize(shim, Redis, 'ioredis');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('set', (t) => {
        redis.set("foo", "bar");
        t.equal('set', shim.interceptedArgs.payloadType);
        t.equal(2, shim.interceptedArgs.payload.length);
        t.end();
    })

    t.test('get', (t) => {
        redis.get("foo", () => {
            t.equal('get', shim.interceptedArgs.payloadType);
            t.equal('foo', shim.interceptedArgs.payload[0]);
            t.end();
        });
    })

    t.test('del', (t) => {
        redis.del("foo");
        t.equal('del', shim.interceptedArgs.payloadType);
        t.equal('foo', shim.interceptedArgs.payload[0]);
        t.end();
    })

    t.test('sadd', (t) => {
        redis.sadd("set", 1, 3, 5, 7);
        t.equal('sadd', shim.interceptedArgs.payloadType);
        t.equal(5, shim.interceptedArgs.payload.length);
        t.end();
    })

    t.test('sadd_list', (t) => {
        redis.sadd("set", [1, 3, 5, 7]);
        t.equal('sadd', shim.interceptedArgs.payloadType);
        t.equal(5, shim.interceptedArgs.payload.length);
        t.end();
    })

    t.test('spop', (t) => {
        redis.spop("set");
        t.equal('spop', shim.interceptedArgs.payloadType);
        t.equal('set', shim.interceptedArgs.payload[0]);
        t.end();
    })

    t.test('zadd', (t) => {
        redis.zadd("sortedSet", 1, "one", 2, "dos", 4, "quatro", 3, "three");
        t.equal('zadd', shim.interceptedArgs.payloadType);
        t.equal(9, shim.interceptedArgs.payload.length);
        t.end();
    })

    t.test('zadd', (t) => {
        redis.zrange("sortedSet", 0, 2, "WITHSCORES").then(() => { });
        t.equal('zrange', shim.interceptedArgs.payloadType);
        t.equal(4, shim.interceptedArgs.payload.length);
        t.end();
    })

    t.test('hset', (t) => {
        redis.hset("myhash", "field1", "Hello");
        t.equal('hset', shim.interceptedArgs.payloadType);
        t.equal(3, shim.interceptedArgs.payload.length);
        t.end();
    })

    t.test('hgetall', (t) => {
        redis.hgetall("myhash").then(() => { }); // Promise resolves to Object {field1: "Hello"} rather than a string, or array of strings
        t.equal('hgetall', shim.interceptedArgs.payloadType);
        t.equal('myhash', shim.interceptedArgs.payload[0]);
        t.end();
    })

    t.test('set_with', (t) => {
        redis.set("key", 100, "EX", 10);
        t.equal('set', shim.interceptedArgs.payloadType);
        t.equal(4, shim.interceptedArgs.payload.length);
        t.end();
    })

    t.test('config', (t) => {
        redis.config("SET", "notify-keyspace-events", "KEA");
        t.equal('config', shim.interceptedArgs.payloadType);
        t.equal(3, shim.interceptedArgs.payload.length);
        t.end();
    })

    t.teardown(() => {
        process.exit(0)
    })
   

})
