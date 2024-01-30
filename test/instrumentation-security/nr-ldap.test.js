/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities')

const mockLdap = () => {
    function ldap(clientConstructor) {
        this.Client = clientConstructor
    }

    function Client() { }
    Client.prototype.search = (base, opsts, callback) => {
        callback(null, "search called")
    }

    const mockLdap = new ldap(Client)
    mockLdap.createClient = () => {
        return new Client()
    }
    return mockLdap
}

test('ldap', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;
    let ldap = mockLdap()

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../lib/instrumentation-security/hooks/ldap/nr-ldap');
        initialize(shim, ldap, 'ldapjs');
    })

    t.afterEach(() => {
        helper && helper.unload()
    })

    t.test('search', (t) => {
        const ldapClient = ldap.createClient();
        var opts = {
            filter: "(&(uid=user1))",
            attributes: ["cn", "uid", "gid", "description", "homedirectory", "shell"],
        };
        ldapClient.search("o=myhost", opts, (err, res) => {
            t.equal(shim.interceptedArgs.length, 1)
            t.same(shim.interceptedArgs[0].name, "o=myhost")
            t.same(shim.interceptedArgs[0].filter, opts.filter)
            t.end()
        });
    })

    t.test('search_requestNotFound', (t) => {
        const ldapClient = ldap.createClient();
        var opts = {
            filter: "(&(uid=user1))",
            attributes: ["cn", "uid", "gid", "description", "homedirectory", "shell"],
        };
        ldapClient.search("o=myhost", opts, (err, res) => {
            t.equal(shim.interceptedArgs.length, 1)
            t.same(shim.interceptedArgs[0].name, "o=myhost")
            t.same(shim.interceptedArgs[0].filter, opts.filter)
            t.end()
        });
    })

    t.test('initialize_moduleName_not_ldapjs', (t) => {
        t.doesNotThrow(() => initialize(shim, ldap, 'ldap1'))
        t.end();
    })
})