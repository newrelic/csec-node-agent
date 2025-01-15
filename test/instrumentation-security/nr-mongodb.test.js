/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */
'use strict'

const test = require('tap').test;
const sinon = require('sinon')
const utils = require('@newrelic/test-utilities')
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const mongodb2 = require('mongodb2');
const mongodb3 = require('mongodb3');
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;

const { Docker } = require('docker-cli-js');
const options = {
  machineName: null, // uses local docker
  currentWorkingDirectory: null, // uses current working directory
  echo: true, // echo command output to stdout/stderr
};
var docker = new Docker(options)

const dbSetup = async () => {
  require('child_process').execSync('docker rm -f mongodb && docker run -d -p 27017:27017 --name mongodb mongo:4 && sleep 5');
}

const tearDownMongoDB = async () => {
  try {
      docker.command('rm -f dynamodb', (data) => {});
  } catch (err) {
      console.error('Table delete fail: ', err)
  }
}

test('mongodb', (t) => {
  t.autoend();
  let helper = null;
  let initialize = null;
  let shim = null;
  let client = null;

  t.before(async () => {
    await dbSetup()
  });

  t.teardown(async () => {
      await tearDownMongoDB;
  });

  t.test('v2', (t) => {
    t.autoend()
    t.beforeEach(async () => {
      helper = utils.TestAgent.makeInstrumented()
      shim = helper.getShim();
      initialize = require('../../lib/instrumentation-security/hooks/mongodb/nr-mongodb');
      sinon.stub(shim, 'require').returns({ version: '2.2.36' });
      initialize(shim, mongodb2, 'mongodb');
      client = await mongodb2.MongoClient.connect("mongodb://localhost/test", {});
    })

    t.afterEach(async () => {
      helper && helper.unload()
      if (client) {
        await client.close();
      }
    })

    t.test('insertMany', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      var docs = [{ a: 1 }, { a: 2 }, { a: 3 }];
      const result = await collection.insertMany(docs);
      t.same(result.insertedCount, 3)
      t.end();
    })

    t.test('findOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.findOne({});
      t.ok(result)
      t.end();
    })

    t.test('updateOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const updateDoc = { $set: { a: 4 } };
      const result = await collection.updateOne({ a: 1 }, updateDoc, { upsert: true });
      t.same(result.modifiedCount, 1)
      t.end();
    })

    t.test('deleteOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.deleteOne({ a: 4 });
      t.same(result.deletedCount, 1)
      t.end();
    })

    t.test('find', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.find({}).toArray();
      t.same(result.length, 2)
      t.end();
    })

    t.test('insertOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.insertOne({ a: 5 });
      t.same(result.insertedCount, 1)
      t.end();
    })
  })

  t.test('v3', (t) => {
    t.autoend()
    t.beforeEach(async () => {
      helper = utils.TestAgent.makeInstrumented()
      shim = helper.getShim();
      initialize = require('../../lib/instrumentation-security/hooks/mongodb/nr-mongodb');
      sinon.stub(shim, 'require').returns({ version: '3.0.6' });
      initialize(shim, mongodb3, 'mongodb');
      client = await mongodb3.MongoClient.connect("mongodb://localhost/test", {});
    })

    t.afterEach(async () => {
      helper && helper.unload()
      if (client) {
        await client.close();
      }
    })

    t.test('insertMany', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      var docs = [{ a: 1 }, { a: 2 }, { a: 3 }];
      const result = await collection.insertMany(docs);
      t.same(result.insertedCount, 3)
      t.end();
    })

    t.test('findOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.findOne({});
      t.ok(result)
      t.end();
    })

    t.test('updateOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const updateDoc = { $set: { a: 4 } };
      const result = await collection.updateOne({ a: 1 }, updateDoc, { upsert: true });
      t.same(result.modifiedCount, 1)
      t.end();
    })

    t.test('deleteOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.deleteOne({ a: 4 });
      t.same(result.deletedCount, 1)
      t.end();
    })

    t.test('countDocuments', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.countDocuments();
      t.same(result, 5)
      t.end();
    })

    t.test('find', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.find({}).toArray();
      t.same(result.length, 5)
      t.end();
    })

    t.test('insertOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.insertOne({ a: 5 });
      t.same(result.insertedCount, 1)
      t.end();
    })
  })

  t.test('v4', (t) => {
    t.autoend()
    t.beforeEach(async () => {
      helper = utils.TestAgent.makeInstrumented()
      shim = helper.getShim();
      initialize = require('../../lib/instrumentation-security/hooks/mongodb/nr-mongodb');
      sinon.stub(shim, 'require').returns({ version: '4.1.0' });
      initialize(shim, mongodb, 'mongodb');
      client = await MongoClient.connect("mongodb://localhost/test", {});
    })

    t.afterEach(async () => {
      helper && helper.unload()
      if (client) {
        await client.close();
      }
    })

    t.test('insertMany', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      var docs = [{ a: 1 }, { a: 2 }, { a: 3 }];
      const result = await collection.insertMany(docs);
      t.same(result.insertedCount, 3)
      t.end();
    })

    t.test('findOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.findOne({});
      t.ok(result)
      t.end();
    })

    t.test('updateOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const updateDoc = { $set: { a: 4 } };
      const result = await collection.updateOne({ a: 1 }, updateDoc, { upsert: true });
      t.same(result.modifiedCount, 1)
      t.end();
    })

    t.test('deleteOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.deleteOne({ a: 4 });
      t.same(result.deletedCount, 1)
      t.end();
    })

    t.test('countDocuments', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.countDocuments();
      t.same(result, 8)
      t.end();
    })

    t.test('insertOne', async (t) => {
      const db = client.db("test");
      var collection = db.collection('documents');
      const result = await collection.insertOne({ a: 9 });
      t.ok(result)
      t.end();
    })
  })
})