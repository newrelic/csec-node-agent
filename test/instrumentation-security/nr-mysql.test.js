/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities')

const mockConnection = () => {
  return {
    connect: () => {
      return 'Succesfully connected';
    },
    query: (query, callback) => {
      callback(null, "Query executed");
    },
    end: () => {
      console.log('Connection ended');
    },
    add: () => {
      console.log('Added config');
    },
    getConnection: (config, callback) => {
      return 'Connection';
    }
  };
}

test('mysql', (t) => {
  t.autoend();
  let helper = null;
  let initialize = null;
  let shim = null;
  let mockMysql = getMockModule();

  t.beforeEach(() => {
    helper = utils.TestAgent.makeInstrumented()
    shim = helper.getShim();
    initialize = require('../../lib/instrumentation-security/hooks/mysql/nr-mysql');
    initialize(shim, mockMysql, 'mysql');
  })

  t.afterEach(() => {
    helper && helper.unload()
  })

  function getMockModule() {
    function Mysql() { }
    Mysql.prototype.query = function () { }
    Mysql.prototype.createConnection = mockConnection;
    Mysql.prototype.createPool = mockConnection;
    Mysql.prototype.createPoolCluster = mockConnection;

    return new Mysql()
  }

  t.test('createConnection', (t) => {
    let con = mockMysql.createConnection({
      host: "localhost",
      user: "root",
      password: "3306"
    });

    var res = con.connect();
    t.same(res, "Succesfully connected");
    t.end();
  })

  t.test('createPool', (t) => {
    let pool = mockMysql.createPool({
      connectionLimit: 100,
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'db',
    });
    pool.query("SELECT * FROM TABLE_NAME", (err, data) => {
      t.same(data, "Query executed");
      t.end();
    });
  })

  t.test('createPoolCluster', (t) => {
    const poolCluster = mockMysql.createPoolCluster();
    poolCluster.add('MASTER', {});
    poolCluster.add('SLAVE', {});
    let con = poolCluster.getConnection(function (err, connection) { });
    t.same(con, 'Connection')
    poolCluster.end(function (err) { })
    t.end();
  })

  t.test('mysql2', (t) => {
    let con = mockMysql.createConnection({
      host: "localhost",
      user: "root",
      password: "3306"
    });

    var res = con.connect();
    t.same(res, "Succesfully connected");
    t.end();
  })
})