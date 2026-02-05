/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */
const { request, Agent, setGlobalDispatcher } = require('undici');
const commonUtils = require('../commonUtils');
const IASTUtil = require('./websocket/response/IASTUtils');
const DEFAULT_HEADERS = {
  accept: null,
  ['accept-encoding']: null,
  ['content-type']: null,
  ['sec-ch-ua-platform']: null,
  ['user-agent']: null
};

class Request {
  constructor(config = {}, logger) {
    const serverName = config.serverName ?? 'localhost';
    const host = `${serverName}:${config.serverPort}`;
    this.logger = logger;
    this.url = `${config.protocol}://${host}${config.url}`;
    this.method = config.method;
    this.body = config.body;
    this.headers = this.assignHeaders(config)
    this.id = config.id;
    this.keepAlive = true
    const agent = new Agent({
      keepAliveTimeout: 5,
      connect: {
        rejectUnauthorized: false
      }
    });
    setGlobalDispatcher(agent);
  }

  send(fuzzDetails) {
    const { rawFuzzRequest, fuzzRequest } = fuzzDetails;
    IASTUtil.completedRequestsMapInit(this.id)
    this.logger.info(`Firing http request:: URL: ${this.url}`);
    request(this.url, {
      method: this.method,
      body: this.body,
      headers: this.headers,
      signal: AbortSignal.timeout(5000)
    }).then(() => {
      this.logger.info('Fuzz success: ' + rawFuzzRequest)
    }).catch(() => {
      this.logger.debug('Error occurred: ', this.url, fuzzRequest);
    }).finally(() => {
      IASTUtil.removePendingRequestId(this.id);
      if (commonUtils.scanStartTime === 0) {
        commonUtils.scanStartTime = Date.now();
      }
    });
  }

  assignHeaders({ headers = {}, id }) {
    const contentType = headers['content-type'];
    if (contentType) {
      const [firstType] = contentType.split(';');
      headers['content-type'] = firstType ?? contentType;
    }

    if (headers['content-length']) {
      delete headers['content-length'];
    }

    headers['nr-csec-parent-id'] = id;

    return {...DEFAULT_HEADERS, ...headers };
  }
}


module.exports = Request;
