/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

'use strict'

const test = require('tap').test;
const fs = require('fs');
const fsPromises = require('fs').promises;
const utils = require('@newrelic/test-utilities');

const fileName = __dirname + '/test.txt';

test('FS', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/fs/nr-fs');
        initialize(shim, fs, 'fs');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.teardown(() => {
        fs.rm(__dirname + '/test1.txt', () => {
            console.log('file deleted')
        })
        fs.rmdir(__dirname + 'test', () => { });
        fs.unlink('symlinkToFile', () => { });
    })

    t.test('open', (t) => {
        fs.open(__dirname + '/test.txt', 'r+', function (err, fd) {
            if (err) {
                return console.error(err);
            }
            console.log("File open successfully");
        });
        t.end();
    })

    t.test('read', (t) => {
        var buffer = new Buffer.alloc(1024);
        fs.open(__dirname + '/test.txt', 'r+', function (err, fd) {
            t.notOk(err, 'should not throw error')

            fs.read(fd, buffer, 0, buffer.length, 0, function (err, bytes) {
                t.notOk(err, 'should not throw error')
                t.equal(true, bytes > 0)
                const data = buffer.slice(0, bytes).toString();
                t.same(data, 'FS hook test')
                fs.close(fd, function (err) {
                    console.log("file closed");
                });
                t.end();
            });
        });
    })

    t.test('rename', (t) => {
        fs.rename('test.txt', 'test1.txt', () => {
            t.end();
        });
    })

    t.test('mkdir', (t) => {
        fs.mkdir(__dirname + 'test', (err) => {
            t.end()
        });
    })

    t.test('chown', (t) => {
        fs.chown(fileName, 1541, 999, (error) => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal(fileName, shim.interceptedArgs[0])
            t.end()
        });
    })

    t.test('chmod', (t) => {
        fs.chmod("test.txt", 0o600, () => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal("test.txt", shim.interceptedArgs[0])
            t.end()
        });
    })

    t.test('readdir', (t) => {
        fs.readdir(__dirname, (err, files) => {
            t.notOk(err);
            t.equal(1, shim.interceptedArgs.length)
            t.equal(__dirname, shim.interceptedArgs[0]);
            t.end()
        })
    })

    t.test('rmdir', (t) => {
        fs.rmdir("test_dir", () => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal("test_dir", shim.interceptedArgs[0]);
            t.end()
        });
    })

    t.test('symlink', (t) => {
        fs.symlink("test.txt", "symlinkToFile", 'file', (err) => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal("test.txt", shim.interceptedArgs[0]);
            t.end()
        })
    })

    t.test('link', (t) => {
        fs.link("test.txt", "hardlinkToFile", (err) => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal("test.txt", shim.interceptedArgs[0]);
            t.end()
        });
    })

    t.test('readFile', (t) => {
        fs.readFile('test.txt', 'utf8', (err, data) => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal("test.txt", shim.interceptedArgs[0]);
            t.end()
        });
    })

    t.test('copyFile', (t) => {
        fs.copyFile("test.txt", "test1.txt", (err) => {
            t.equal(1, shim.interceptedArgs.length)
            t.equal("test.txt", shim.interceptedArgs[0]);
            t.end()
        });
    })

    t.test('fsPromises_mkdir', (t) => {
        fsPromises.mkdir(__dirname + '/test')
            .then((result) => {
                t.equal(1, shim.interceptedArgs.length)
                t.equal(__dirname + '/test', shim.interceptedArgs[0]);
                t.end()
            }).catch(function (error) { })
    })

    t.test('fsPromises_readdir', (t) => {
        fsPromises.readdir(__dirname + '/test')
            .then((result) => {
                t.equal(1, shim.interceptedArgs.length)
                t.equal(__dirname + '/test', shim.interceptedArgs[0]);
                t.end()
            }).catch(function (error) { });
    })

    t.test('fsPromises_rmdir', (t) => {
        fsPromises.rmdir(__dirname + '/test')
            .then((result) => {
                t.equal(1, shim.interceptedArgs.length)
                t.equal(__dirname + '/test', shim.interceptedArgs[0]);
                t.end()
            }).catch(function (error) { });
    })

    t.test('fsPromise_readFile', (t) => {
        fsPromises.readFile(fileName)
            .then(function (result) {
                t.ok(shim.interceptedArgs)
                t.equal(1, shim.interceptedArgs.length)
                t.equal(shim.interceptedArgs[0], fileName);
                t.end()
            }).catch(function (error) { });
    })

    t.test('fsPromise_copyFile', (t) => {
        fsPromises.copyFile(fileName, __dirname + "/test1.txt")
            .then((result) => {
                t.equal(1, shim.interceptedArgs.length)
                t.equal(fileName, shim.interceptedArgs[0]);
                t.end()
            }).catch((error) => { });
    })

    t.test('fsPromise_writeFile', async (t) => {
        await fsPromises.writeFile(__dirname + '/test1.txt', "Updated text");
        t.equal(1, shim.interceptedArgs.length)
        t.equal(__dirname + '/test1.txt', shim.interceptedArgs[0]);
        t.end()
    })

    t.test('stat', (t) => {
        fs.stat(fileName, function (err, stats) {
            t.ok(shim.interceptedArgs)
            t.equal(1, shim.interceptedArgs.length)
            t.equal(fileName, shim.interceptedArgs[0])
            t.end()
        });
    })

    t.test('access', (t) => {
        fs.stat(fileName, function (err, stats) {
            t.ok(shim.interceptedArgs)
            t.equal(1, shim.interceptedArgs.length)
            t.equal(fileName, shim.interceptedArgs[0])
            t.end()
        });
    })

    t.test('exists', (t) => {
        fs.stat(fileName, function (err, stats) {
            t.ok(shim.interceptedArgs)
            t.equal(1, shim.interceptedArgs.length)
            t.equal(fileName, shim.interceptedArgs[0])
            t.end()
        });
    })

    t.test('statSync', (t) => {
        fs.existsSync(fileName)
        t.ok(shim.interceptedArgs)
        t.equal(1, shim.interceptedArgs.length)
        t.equal(fileName, shim.interceptedArgs[0])
        t.end()
    })

    t.test('accessSync', (t) => {
        fs.existsSync(fileName)
        t.ok(shim.interceptedArgs)
        t.equal(1, shim.interceptedArgs.length)
        t.equal(fileName, shim.interceptedArgs[0])
        t.end()
    })

    t.test('existsSync', (t) => {
        fs.existsSync(fileName)
        t.ok(shim.interceptedArgs)
        t.equal(1, shim.interceptedArgs.length)
        t.equal(fileName, shim.interceptedArgs[0])
        t.end()
    })
})


