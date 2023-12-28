/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities');
const crypto = require('crypto');

test('crypto', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/crypto/nr-crypto');
        initialize(shim, crypto, 'crypto');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('crypto.randomBytes', (t) => {
        let x = crypto.randomBytes(16);
        t.equal(true, x instanceof Buffer)
        t.equal(16, shim.interceptedArgs[0])
        t.end();
    })

    t.test('crypto.randomInt', (t) => {
        let x = crypto.randomInt(11);
        t.equal(true, Number.isInteger(x))
        t.equal(11, shim.interceptedArgs[0])
        t.end();
    })

    t.test('Math.random', (t) => {
        let x = Math.random(21);
        t.equal(false, isNaN(x))
        t.equal(21, shim.interceptedArgs[0])
        t.end();
    })

    t.test('crypto.createHash', (t) => {
        const md5Hash = crypto.createHash('md5');
        // Data to be hashed
        const data = 'Hello, world!';
        // Update the hash with the data
        md5Hash.update(data);
        // Obtain the hash digest in hexadecimal form
        const hashResult = md5Hash.digest('hex');
        t.equal(true, typeof hashResult === 'string')
        t.equal('md5', shim.interceptedArgs[0])
        t.end();
    })

    t.test('crypto.createHmac', (t) => {
        // Secret key for HMAC
        const secretKey = 'mySecretKey';
        // Data to be hashed
        const data = 'Hello, world!';
        // Create an HMAC object with the SHA256 algorithm
        const hmac = crypto.createHmac('sha256', secretKey);
        // Update the HMAC object with the data
        hmac.update(data);
        // Obtain the HMAC digest in hexadecimal form
        const hmacResult = hmac.digest('hex');
        t.equal(true, typeof hmacResult === 'string')
        t.equal('sha256', shim.interceptedArgs[0])
        t.end();
    })

    t.test('crypto.createCipheriv', (t) => {
        let text = 'Sumit Suthar';
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        let iv1 = iv.toString('hex');
        let encryptedData = encrypted.toString('hex')

        t.equal('aes-256-cbc', shim.interceptedArgs[0]);
        t.equal(true, typeof encryptedData === 'string')
        t.equal(false, typeof iv1 !== 'string')
        t.end();
    })

})

