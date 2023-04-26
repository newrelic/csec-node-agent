/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities')
const xpath = require('xpath')
const dom = require("xmldom").DOMParser

test('xpath', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/xpath/nr-xpath');
        initialize(shim, xpath, 'xpath');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('select', (t) => {
        var xml = "<book><title>Hello World</title></book>"
        var doc = new dom().parseFromString(xml)
        var expression = "string(//title)"
        var title = xpath.select(expression, doc)
        t.equal(shim.interceptedArgs.length, 1)
        t.same(shim.interceptedArgs[0], expression)
        t.same(title, "Hello World");
        t.end();
    })

    t.test('useNamespaces', (t) => {
        var xml = "<book xmlns:bookml='http://example.com/book'><bookml:title>Hello World</bookml:title></book>"
        var doc = new dom().parseFromString(xml)
        var select = xpath.useNamespaces({ "bookml": "http://example.com/book" });
        var expression = "//bookml:title/text()"
        var title = select(expression, doc)[0].nodeValue;
        t.equal(shim.interceptedArgs.length, 1)
        t.same(shim.interceptedArgs[0], expression)
        t.same(title, "Hello World");
        t.end();
    })

    t.test('evaluate', (t) => {
        var xml = "<book author='J. K. Rowling'><title>Harry Potter</title></book>"
        var doc = new dom().parseFromString(xml)
        var expression = "/book/title"
        var result = xpath.evaluate(expression, doc, null, xpath.XPathResult.ANY_TYPE, null)
        t.equal(shim.interceptedArgs.length, 1)
        t.same(shim.interceptedArgs[0], expression)
        t.end();
    })

    t.test('initialize_moduleName_not_xpath', (t) => {
        t.doesNotThrow(() => initialize(shim, xpath, 'xpath1'))
        t.end();
    })
})

test('xpath.js', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;
    let xpathDotJs = require('xpath.js');

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        xpathDotJs = require('xpath.js')
        shim.get
        initialize = require('../../lib/instrumentation-security/hooks/xpath/nr-xpath');

        initialize(shim, xpathDotJs, 'xpath.js');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('select', (t) => {
        var xml = "<book><title>Hello World</title></book>"
        var doc = new dom().parseFromString(xml)
        var expression = "//title"
        var nodes = xpathDotJs(doc, expression)
        t.same(nodes[0].firstChild.data, "Hello World");
        t.end();
    })
})