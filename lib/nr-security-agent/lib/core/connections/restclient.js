/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const axios = require('axios').default;

const http = require('http');
const https = require('https');
const logger = require('../logging').getLogger();

const axiosInstance = axios.create({
    httpAgent: new http.Agent({
        keepAlive: true,
        maxSockets: 100,
        maxFreeSockets: 50,
        timeout: 5000, // 30 seconds
        keepAliveTimeout: 10000,
    }),
    httpsAgent: new https.Agent({
        keepAlive: true,
        maxSockets: 100,
        maxFreeSockets: 50,
        timeout: 5000, // 30 seconds
        keepAliveTimeout: 10000,
    })
});

/**
 * fire http request based on provided config 
 * @param {*} config 
 * @returns 
 */
function fireRequest(config) {
    axios.defaults.timeout = 5000;
    axios.defaults.headers.common['user-agent'] = null;
    axios.defaults.headers.common['accept-encoding'] = null;
    axios.defaults.headers.common['connection'] = null;
    axios.defaults.headers.common['sec-ch-ua-platform'] = null;
    axios.defaults.headers.common['accept'] = null;
    axios.defaults.headers.common['content-type'] = null;
    return axios(config);
}

function sendEventOverHTTP(config) {
    config.url = "http://localhost:9090/data";
    config.method = 'POST';
    config.headers = { 
        'Content-Type': 'application/json'
      }
    // config.data = {};
    // config.url = "https://example.com";
    // config.method = 'get';
    axiosInstance.request(config).then(response => {
        logger.debug("response is:", response.data);
    }).catch(error => {
            logger.error("error is:", error);
        })
}
// sendEventOverHTTP({});

function sendSecurityEvent(event){
    let config = {};
    config.data = event;
    config.timeout = 5000;
    sendEventOverHTTP(config);
}

module.exports = {
    fireRequest,
    sendSecurityEvent
};
