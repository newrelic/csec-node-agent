/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities');
const clientDynamoDb = require("@aws-sdk/client-dynamodb")
const libDynamoDb = require("@aws-sdk/lib-dynamodb")
const localDynamo = require('local-dynamo')
const { DynamoDBClient, CreateTableCommand, ListTablesCommand, DeleteTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { Docker } = require('docker-cli-js');

const options = {
    machineName: null, // uses local docker
    currentWorkingDirectory: null, // uses current working directory
    echo: true, // echo command output to stdout/stderr
  };
var docker = new Docker(options)

let client = null;
let documentClient = null;
const TABLE_NAME = "users_v3";

const dbSetup = async () => {
    docker.command('rm -f dynamodb2', (data) => {});
    docker.command('run -p 8000:7000 --name dynamodb2 amazon/dynamodb-local', (data) => {});
    client = new DynamoDBClient(
        {
            endpoint: 'http://127.0.0.1:7000',
            region: 'local',
            credentials: {
                accessKeyId: 'accessKeyId',
                secretAccessKey: 'secretAccessKey'
            }
        }
    )
    documentClient = DynamoDBDocumentClient.from(client);
}

test('dynamodb - v3', (t) => {
    t.autoend();
    let helper = null;
    let shim = null;

    t.before(async () => {
        await dbSetup();
    })

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        var initializeClient = require('../../../lib/instrumentation-security/hooks/dynamodb/v3/client-dynamodb');
        var initializeLib = require('../../../lib/instrumentation-security/hooks/dynamodb/v3/lib-dynamodb');
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        sinon.stub(shim, 'require').returns({ version: '3.2.0' })
        initializeClient(shim, clientDynamoDb, '@aws-sdk/client-dynamodb');
        initializeLib(shim, libDynamoDb, '@aws-sdk/lib-dynamodb');
    })

    t.afterEach(() => {
        helper && helper.unload();
    })

    t.teardown(() => {
        docker.command('rm -f dynamodb2', (data) => {});
    })

    t.test('createTable', async (t) => {
        const params = {
            TableName: TABLE_NAME,
            KeySchema: [
                { AttributeName: "id", KeyType: "HASH" },  //Partition key
            ],
            AttributeDefinitions: [
                { AttributeName: "id", AttributeType: "N" },
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            }
        };
        var command = new CreateTableCommand(params);
        const data = await client.send(command);
        t.ok(data)
        t.end();
    })

    t.test('ListTablesCommand', async (t) => {
        const command = new ListTablesCommand({});
        const response = await client.send(command);
        t.ok(response);
    })

    t.test('PutCommand', async (t) => {
        var command = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                id: 1,
            },
        });

        const response = await documentClient.send(command);
        t.ok(response);
    })

    t.test('GetCommand', async (t) => {
        var command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                id: 1
            }
        });

        const response = await documentClient.send(command);
        t.ok(response);
    })

    t.test('UpdateCommand', async (t) => {
        var command = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
                id: 1,
            },
            ReturnValues: "ALL_NEW",
        });

        const response = await documentClient.send(command);
        t.ok(response);
    })

    t.test('QueryCommand', async (t) => {
        var command = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "id = :id",
            ExpressionAttributeValues: {
                ":id": 1
            },
            ConsistentRead: true,
        });


        const response = await documentClient.send(command);
        t.ok(response);
    })

    t.test('DeleteCommand', async (t) => {
        var command = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                id: 1,
            },
        });

        const response = await documentClient.send(command);
        t.ok(response);
    })

    t.test('deleteTable', async (t) => {
        const command = new DeleteTableCommand({
            TableName: TABLE_NAME,
        });

        const data = await client.send(command);
        t.ok(data)
        t.end();
    })
})