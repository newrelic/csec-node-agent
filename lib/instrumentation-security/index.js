/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const API = require('../nr-security-api');
const newrelic = API.newrelic;
const logger = API.getLogger();

logger.info("Started instrumentation using shimmer module");


newrelic.instrument({
  moduleName: 'child_process',
  onRequire: require('./hooks/native/nr-childProcess'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})
newrelic.instrument({
  moduleName: 'http',
  onRequire: require('./hooks/http/nr-http'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrument({
  moduleName: 'https',
  onRequire: require('./hooks/http/nr-http'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrument({
  moduleName: 'fs',
  onRequire: require('./hooks/fs/nr-fs'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentWebframework({
  moduleName: 'express',
  onRequire: require('./hooks/express/nr-express'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentDatastore({
  moduleName: 'mysql',
  onRequire: require('./hooks/mysql/nr-mysql'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentDatastore({
  moduleName: 'mysql2',
  onRequire: require('./hooks/mysql/nr-mysql'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentDatastore({
  moduleName: 'mongodb',
  onRequire: require('./hooks/mongodb/nr-mongodb'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrument({
  moduleName: 'ldapjs',
  onRequire: require('./hooks/ldap/nr-ldap'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrument({
  moduleName: 'ldapts',
  onRequire: require('./hooks/ldap/nr-ldap'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})


newrelic.instrument({
  moduleName: 'xpath',
  onRequire: require('./hooks/xpath/nr-xpath'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})
newrelic.instrument({
  moduleName: 'xpath.js',
  onRequire: require('./hooks/xpath/nr-xpath'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentDatastore({
  moduleName: 'pg',
  onRequire: require('./hooks/postgres/nr-postgres'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentWebframework({
  moduleName: 'fastify',
  onRequire: require('./hooks/fastify/nr-fastify'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})


newrelic.instrumentWebframework({
  moduleName: 'restify',
  onRequire: require('./hooks/restify/nr-restify'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentWebframework({
  moduleName: '@koa/router',
  onRequire: require('./hooks/koa/@koa/nr-@koa-router'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentWebframework({
  moduleName: 'koa-router',
  onRequire: require('./hooks/koa/@koa/nr-@koa-router'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentWebframework({
  moduleName: '@hapi/hapi',
  onRequire: require('./hooks/hapi/nr-hapi'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentWebframework({
  moduleName: 'director',
  onRequire: require('./hooks/director/nr-director'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentDatastore({
  moduleName: 'aws-sdk',
  onRequire: require('./hooks/dynamodb/nr-dynamodb'),
  onError: function intrumentErrorHandler(err) {
    logger.error(err.message, err.stack)
  }
})

newrelic.instrumentDatastore({
  moduleName: '@aws-sdk/client-dynamodb',
  onRequire: require('./hooks/dynamodb/nr-client-dynamodb'),
  onError: function intrumentErrorHandler(err) {
  }
})










