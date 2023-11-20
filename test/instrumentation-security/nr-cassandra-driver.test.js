/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */
'use strict'

const test = require('tap').test;
const utils = require('@newrelic/test-utilities')
const sinon = require('sinon');
const CassandraDriver = require('cassandra-driver');
const { Client, types } = CassandraDriver;

const client = new Client({
  contactPoints: ['h1', 'h2'],
  localDataCenter: 'datacenter1',
  keyspace: 'ks1'
});

const _executeStub = sinon.stub(Client.prototype, '_execute');
_executeStub.returns({ rows: [] });

test('cassandra-driver', (t) => {
  t.autoend();
  let helper = null;
  let initialize = null;
  let shim = null;
  let requireStub = null;

  t.beforeEach(() => {
    helper = utils.TestAgent.makeInstrumented()
    shim = helper.getShim();
    requireStub = sinon.stub(shim, 'require');
    requireStub.returns({ version: '4.5.6' });
    initialize = require('../../lib/instrumentation-security/hooks/cassandra/nr-cassandra-driver');
    initialize(shim, CassandraDriver, 'cassandra-driver');
  })

  t.afterEach(() => {
    helper && helper.unload()
  })

  t.test('should perform a successful query', async (t) => {
    const expectedResult = { rows: [{ name: 'John', email: 'john@test.com' }] };
    _executeStub.resolves(expectedResult);

    const query = 'SELECT name, email FROM users WHERE key = ?';
    const result = await client.execute(query, ['someone']);
    t.equal(result.rows[0].email, expectedResult.rows[0].email);
  });

  t.test('should perform a successful query when version < 4.4.0', async (t) => {
    requireStub.returns({ version: '4.2.6' });
    initialize(shim, CassandraDriver, 'cassandra-driver');
    const expectedResult = { rows: [{ name: 'John', email: 'john@test.com' }] };
    _executeStub.resolves(expectedResult);

    const query = 'SELECT name, email FROM users WHERE key = ?';
    const result = await client.execute(query, ['someone']);
    t.equal(result.rows[0].email, expectedResult.rows[0].email);
  });

  t.test('should perform a successful batch query', async (t) => {
    _executeStub.restore();
    initialize(shim, CassandraDriver, 'cassandra-driver');
    const expectedResult = { rows: [{ name: 'John123', email: 'john@test.com' }] };
    sinon.stub(Client.prototype, 'batch').resolves(expectedResult);

    const queries = [
      {
        query: 'SELECT name, email FROM users WHERE key = ?',
        params: [1]
      }
    ];

    const batch = {
      queries: queries,
      consistency: types.consistencies.quorum,
      serialConsistency: types.consistencies.localSerial,
      timestamp: Date.now()
    };
    
    const result = await client.batch(batch, { prepare: true });
    console.log(result)
    t.equal(result.rows[0].email, expectedResult.rows[0].email);
  });
})