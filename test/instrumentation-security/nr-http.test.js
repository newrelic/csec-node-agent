/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const utils = require('@newrelic/test-utilities')
const http = require('http')
const sinon = require('sinon');

function makeRequest(params, data, cb) {
  const req = http.request(params, function (res) {
    if (res.statusCode !== 200) {
      return cb(null, res.statusCode, null)
    }

    res.setEncoding('utf8')
    res.on('data', function (data) {
      cb(null, res.statusCode, data)
    })
  })

  req.on('error', function (err) {
    // If we aborted the request and the error is a connection reset, then
    // all is well with the world. Otherwise, ERROR!
    if (params.abort && err.code === 'ECONNRESET') {
      cb()
    } else {
      cb(err)
    }
  })

  if (params.abort) {
    setTimeout(function () {
      req.abort()
    }, params.abort)
  }
  if (data) {
    req.write(JSON.stringify(data))
  }
  req.end()
}

test('http', (t) => {
  t.autoend()

  let helper = null;
  let shim = null
  let initialize = null

  const PAYLOAD = JSON.stringify({ msg: 'ok' })

  t.test('initialize', (t) => {
    helper = utils.TestAgent.makeInstrumented()
    shim = helper.getShim();
    initialize = require('../../lib/instrumentation-security/hooks/http/nr-http')
    sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 }, headers: { "nr-csec-fuzz-request-id": "test" } });
    t.doesNotThrow(() => initialize(shim, http, 'http'))
    helper && helper.unload()
    t.end()
  })

  t.test('request', (t) => {
    t.autoend()

    let server = null, server2 = null;

    t.before(() => {
      helper = utils.TestAgent.makeInstrumented()
      shim = helper.getShim();
      initialize = require('../../lib/instrumentation-security/hooks/http/nr-http')
      sinon.stub(shim, 'getActiveSegment').returns({ transaction: { id: 1 }, headers: { "nr-csec-fuzz-request-id": "test" } });
      initialize(shim, http, 'http')

      server = http.createServer(function (request, response) {
        response.writeHead(200, {
          'Content-Length': PAYLOAD.length,
          'Content-Type': 'application/json'
        })
        if (request.method === 'POST' && request.url === '/echo') {
          let body = [];
          request.on('data', (chunk) => {
            body.push(chunk);
          }).on('end', () => {
            body = Buffer.concat(body).toString();
            response.end(body);
          });
        } else {
          response.write(PAYLOAD)
          response.end()
        }
      })

      server.on('request', (req, res) => {
        let body = [];
        req.on('data', (chunk) => {
          body.push(chunk);
        }).on('end', () => {
          body = Buffer.concat(body).toString();
          res.end(body);
        });
      });

      server.listen(8123, 'localhost', function () {
        console.log('server started')
      })
    })

    t.teardown(() => {
      helper && helper.unload()
      if (server) {
        server.close();
      }
      if (server2) {
        server2.close()
      }
    })

    t.test('GET', (t) => {
      const refererUrl = 'https://www.google.com/search/cats?scrubbed=false'
      const userAgent = 'Palm680/RC1'

      makeRequest(
        {
          port: 8123,
          host: 'localhost',
          path: '/path',
          method: 'GET',
          headers: {
            'self-test': 1,
            'referer': refererUrl,
            'User-Agent': userAgent
          }
        },
        null,
        finish
      )

      function finish(err, statusCode, body) {
        t.same(statusCode, 200)
        t.end()
      }
    })

    t.test('POST', (t) => {
      server2 = http.createServer((request, response) => {
        console.log(request.method + " " + request.url)
        if (request.method === 'POST' && request.url === '/echo') {
          let body = [];
          request.on('data', (chunk) => {
            body.push(chunk);
          }).on('end', () => {
            body = Buffer.concat(body).toString();
            response.end(body);
          });
        } else {
          response.statusCode = 404;
          response.end();
        }
      })
      server2.listen(8080);
      var request = require('request');
      var options = {
        'method': 'POST',
        'url': 'http://localhost:8080/echo',
        'headers': {
          'self-test': 1,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "name": "Joe"
        })
      };
      request(options, function (error, response) {
        t.end()
      });
    })
  })
})