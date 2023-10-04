'use strict'

const test = require('tap').test;
const sinon = require('sinon');
const utils = require('@newrelic/test-utilities');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const resolvingCall = require('@grpc/grpc-js/build/src/resolving-call')

const packageDefinition = protoLoader.loadSync(__dirname + '/greeter.proto', { keepCase: true });
const hello_proto = grpc.loadPackageDefinition(packageDefinition);

let server = null;

function sayHello(call, callback) {
    callback(null, { message: 'Hello ' + call.request.name });
}

const startServer = () => {
    server = new grpc.Server();
    server.addService(hello_proto.Greeter.service, { sayHello: sayHello });
    server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
        console.log("server started")
        server.start();
    });
    require('child_process').execSync('sleep 1');
}

test('grpc', (t) => {
    t.autoend();
    let helper = null;
    let initialize = null;
    let shim = null;
    let requireStub = null;

    t.beforeEach(() => {
        helper = utils.TestAgent.makeInstrumented()
        shim = helper.getShim();
        initialize = require('../../../lib/instrumentation-security/hooks/grpc-js/nr-grpc');
        requireStub = sinon.stub(shim, 'require');
        requireStub.onFirstCall().returns({ version: '1.9.5' });
        requireStub.onSecondCall().returns(resolvingCall);
        requireStub.onThirdCall().returns(require('@grpc/grpc-js/build/src/server'));
    })

    t.afterEach(() => {
        helper && helper.unload();
    })

    t.test('create client', (t) => {
        initialize(shim, grpc, '@grpc/grpc-js');
        startServer();
        var client = new hello_proto.Greeter('localhost:50051', grpc.credentials.createInsecure());
        client.sayHello({ name: "John" }, (err, response) => {
            server.forceShutdown()
            t.end();
        });
    })

    t.test('when version < 1.8.0', async (t) => {
        requireStub.onFirstCall().returns({ version: '1.5.5' });
        requireStub.onSecondCall().returns(require('@grpc/grpc-js/build/src/call-stream'));
        initialize(shim, grpc, '@grpc/grpc-js');
        startServer();
        var client = new hello_proto.Greeter('localhost:50051', grpc.credentials.createInsecure());
        client.sayHello({ name: "John" }, (err, response) => {
            server.forceShutdown()
            t.end();
        });
    })

    t.test('when version < 1.4.0', async (t) => {
        requireStub.onFirstCall().returns({ version: '1.2.5' });
        requireStub.onSecondCall().returns(require('@grpc/grpc-js/build/src/call-stream'));
        initialize(shim, grpc, '@grpc/grpc-js');
        t.end()
    })

    t.test('loadPackageDefinition', async (t) => {
        requireStub.onCall(3).returns(require('@grpc/grpc-js/build/src/make-client'));
        initialize(shim, grpc, '@grpc/grpc-js');
        grpc.loadPackageDefinition(packageDefinition);
        t.end()
    })
})