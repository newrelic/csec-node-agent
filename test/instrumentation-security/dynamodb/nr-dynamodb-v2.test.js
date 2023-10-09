/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities');
const aws = require('aws-sdk')
const { Docker } = require('docker-cli-js');

const options = {
    machineName: null, // uses local docker
    currentWorkingDirectory: null, // uses current working directory
    echo: true, // echo command output to stdout/stderr
  };
var docker = new Docker(options)

let dynamodb = null;
let docClient = null;
const TABLE_NAME = "users";
const setupAWS = () => {
    aws.config.update(
        {
            endpoint: 'http://localhost:8008',
            region: 'local',
            credentials: {
                accessKeyId: 'accessKeyId',
                secretAccessKey: 'secretAccessKey'
            }
        }
    )
}

const dbSetup = async () => {
    require('child_process').execSync('docker rm -f dynamodb && docker run -d -p 8008:8000 --name dynamodb amazon/dynamodb-local && sleep 5');
    setupAWS()
    dynamodb = new aws.DynamoDB()
    docClient = new aws.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
    try {
        var params = {
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
        const data = await dynamodb.createTable(params).promise();
        console.log('Table created');

        var params = {
            TableName: 'users',
            Item: {
                'id': { N: '001' }
            }
        };
        // Call DynamoDB to add the item to the table
        await dynamodb.putItem(params).promise();
    } catch (err) {
        console.error('Unable to create table: ', err)
    }
}

const tearDownDynamoDB = async () => {
    try {
        const data = await dynamodb.deleteTable({ TableName: TABLE_NAME }).promise();
        console.log('Table Deleted')
        docker.command('rm -f dynamodb', (data) => {});
    } catch (err) {
        console.error('Table delete fail: ', err)
    }
}

test('dynamodb - v2', (t) => {
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
        initialize = require('../../../lib/instrumentation-security/hooks/dynamodb/v2/nr-dynamodb');
        sinon.stub(shim, 'require').returns({ version: '2.2.0' });
        sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 } });
        initialize(shim, aws, 'aws-sdk');
    })

    t.afterEach(() => {
        helper && helper.unload();
    })

    t.teardown(async () => {
        await tearDownDynamoDB();
    })

    t.test('scan', async (t) => {
        const data = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
        t.equal(1, data.Count)
        t.equal('read', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('putItem', async (t) => {
        var params = {
            TableName: 'users',
            Item: {
                'id': { N: '002' }
            }
        };
        // Call DynamoDB to add the item to the table
        await dynamodb.putItem(params).promise();
        t.equal('write', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('put', async (t) => {
        var params = {
            TableName: 'users',
            Item: {
                'id': 3
            }
        };
        // Call DynamoDB to add the item to the table
        await docClient.put(params).promise();
        t.equal('write', shim.interceptedArgs.payloadType)
        t.end();
    })


    t.test('getItem', async (t) => {
        var params = {
            TableName: 'users',
            Key: {
                'id': { N: '001' }
            }
        };
        await dynamodb.getItem(params).promise();
        t.equal('read', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('get', async (t) => {
        var params = {
            TableName: 'users',
            Key: {
                'id': 1
            }
        };
        await docClient.get(params).promise();
        t.equal('read', shim.interceptedArgs.payloadType)
        t.end();
    })


    t.test('updateItem', async (t) => {
        var params = {
            TableName: 'users',
            Key: {
                'id': 1
            },
            ReturnValues: "ALL_NEW",
        };
        await docClient.update(params).promise();
        t.equal('update', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('update', async (t) => {
        var params = {
            TableName: 'users',
            Key: {
                'id': { N: '001' }
            },
            ReturnValues: "ALL_NEW",
        };
        await dynamodb.updateItem(params).promise();
        t.equal('update', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('deleteItem', async (t) => {
        var params = {
            TableName: 'users',
            Key: {
                'id': { N: '002' }
            }
        };
        await dynamodb.deleteItem(params).promise();
        t.equal('delete', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('delete', async (t) => {
        var params = {
            TableName: 'users',
            Key: {
                'id': 3
            }
        };
        await docClient.delete(params).promise();
        t.equal('delete', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('createTable and deleteTable', async (t) => {
        var params = {
            TableName: "test",
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
        await dynamodb.createTable(params).promise();
        t.equal('unknown', shim.interceptedArgs.payloadType)
        await dynamodb.deleteTable({ TableName: "test" }).promise();
        t.equal('unknown', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('query', async (t) => {
        var params = {
            TableName: TABLE_NAME,
            KeyConditionExpression: "#pkName = :pkValue",
            ExpressionAttributeNames: {
                "#pkName": "id"
            },
            ExpressionAttributeValues: {
                ":pkValue": { N: "001" }
            },
        };
        const data = await dynamodb.query(params).promise();
        t.ok(data)
        t.equal('read', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('batchGet', async (t) => {
        var params = {
            RequestItems: {
                users: {
                    Keys: [{ 'id': 1 }, { 'id': 2 }]
                }
            }
        };
        const data = await docClient.batchGet(params).promise();
        t.ok(data);
        t.equal('read', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('batchWrite', async (t) => {
        var params = {
            RequestItems: {
                "users": [
                    {
                        PutRequest: {
                            Item: {
                                "id": 5
                            }
                        }
                    }
                ]
            }
        };
        await docClient.batchWrite(params).promise();
        t.equal('write', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('transactGetItems', async (t) => {
        var params = {
            TransactItems: [
                {
                    Get: {
                        TableName: TABLE_NAME,
                        Key: { 'id': { N: '5' } }
                    }
                }
            ]
        };
        const data = await dynamodb.transactGetItems(params).promise();
        t.ok(data)
        t.equal('read', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('transactWriteItems', async (t) => {
        var params = {
            TransactItems: [
                {
                    Put: {
                        Item: { id: { N: "4" } },
                        TableName: TABLE_NAME,
                    },
                }
            ]
        };
        await dynamodb.transactWriteItems(params).promise();
        t.equal('write', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('batchGetItem', async (t) => {
        var params = {
            RequestItems: {
                "users": {
                    Keys: [{ 'id': { N: "1" } }, { 'id': { N: "2" } }]
                }
            }
        };
        const data = await dynamodb.batchGetItem(params).promise();
        t.ok(data);
        t.equal('read', shim.interceptedArgs.payloadType)
        t.end();
    })

    t.test('batchWriteItem', async (t) => {
        var params = {
            RequestItems: {
                "users": [
                    {
                        PutRequest: {
                            Item: {
                                "id": { N: "6" }
                            }
                        }
                    }
                ]
            }
        };
        await dynamodb.batchWriteItem(params).promise();
        t.equal('write', shim.interceptedArgs.payloadType)
        t.end();
    })
})