/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

/* eslint-disable no-unused-vars */
const stringify = require('fast-safe-stringify');

const restClient = require('../../restclient');
const { Agent } = require('../../../agent');
const { FuzzFailEvent } = require('../../../FuzzFailEvent');
const { hasWorker: isWorkerSupported } = require('../../../commonUtils');
const { CSEC_HOME_TMP, COLON, NR_CSEC_FUZZ_REQUEST_ID, SLASH } = require('../../../sec-agent-constants');
const LOCALHOST = 'localhost';
const COLON_SLASH_SLASH = '://';
const http = require('http');
const https = require('https');
require('dns').setDefaultResultOrder('ipv4first')

const {
    IS_LAMBDA_ENV,
    AWS_LAMBDA_FUNCTION_VERSION_ENV_IDENTIFIER,
    CSEC_LAST_FUZZ_REQUEST_TIME
} = require('../../../sec-agent-constants');
const statusUtils = require('../../../statusUtils');

const find = `${SLASH}{{NR_CSEC_VALIDATOR_HOME_TMP}}`;
const CSEC_HOME_TMP_CONST = new RegExp(find, 'g');

let logger;
let lastFuzzEventTime = 0;

// handler function to parse fuzz event and prepare fuzz request
function handler (json) {
    setLastFuzzEnventTime();
    let rawFuzzRequest = json.arguments[0];
    logger.debug('Fuzz request received::' + rawFuzzRequest);
    rawFuzzRequest = rawFuzzRequest.replace(CSEC_HOME_TMP_CONST, CSEC_HOME_TMP);
    let fuzzRequest;
    try {
        fuzzRequest = JSON.parse(rawFuzzRequest);
    } catch (error) {
        logger.error('Parsing exeception in fuzz request: ', error);
    }
    if (!fuzzRequest) {
        return;
    }

    logger.info('Fuzz request:: Method: ' + fuzzRequest.method);
    logger.info('Fuzz request:: Headers: ' + stringify(fuzzRequest.headers));
    logger.info('Fuzz request:: Data: ' + fuzzRequest.body);

    const fuzzDetails = { fuzzRequest, rawFuzzRequest };
    lastFuzzEventTime = Date.now();
    handleFuzzRequest(fuzzDetails);
};

/**
 * Handles the fuzz request logic after
 * initial parsing
 *
 * @param {Object} fuzzDetails
 */
function handleFuzzRequest (fuzzDetails) {
    const { fuzzRequest } = fuzzDetails;
    try {
        if (IS_LAMBDA_ENV) {
            const qualifiedARN = Agent.getAgent().applicationInfo.applicationUUID;
            const splitArn = String.prototype.split.call(qualifiedARN, ':');
            const arn = splitArn.slice(0, splitArn.length - 1).join(':');
            const ver = process.env[AWS_LAMBDA_FUNCTION_VERSION_ENV_IDENTIFIER];
            logger.info('Invoking Lambda:: ARN: ' + arn);
            logger.info('Invoking Lambda:: Version: ' + ver);
            
        } else {
            const config = parseAxiosHttpRequestToFuzz(fuzzRequest);
            const type = config.headers['content-type'];
            if (type) {
                const splitted = type.split(';');
                if (splitted[0]) {
                    config.headers['content-type'] = splitted[0];
                }
            }
            logger.info('Firing http request:: URL: ' + config.url);

            const request = restClient.fireRequest(config);
            handleFuzzResponse(request, fuzzDetails);
        }
    } catch (err) {
        statusUtils.addErrortoBuffer(err);
        const fuzzFailEvent = new FuzzFailEvent(fuzzRequest.headers[NR_CSEC_FUZZ_REQUEST_ID]);
        logger.error(stringify(fuzzFailEvent));
        try {
            Agent.getAgent().client.dispatcher(fuzzFailEvent);
        } catch (error) {
            logger.debug('Error in sending fuzz request:', error.stack);
        }
    }
}

/**
 * Handles the fuzz response Promise.
 *
 * @param {Promise} request
 * @param {Object} fuzzDetails
 */
function handleFuzzResponse (request, fuzzDetails) {
    const { rawFuzzRequest, fuzzRequest } = fuzzDetails;
    if (request) {
        request.then(() => {
            logger.info('Fuzz success: ' + rawFuzzRequest);
        }).catch(() => {
            logger.debug('Error occured:', fuzzRequest.url, fuzzRequest);
        });
    }
}

/**
 * Parses the passed fuzz request object to
 * Axios config.
 *
 * @param {JSON} requestObject
 */
function parseAxiosHttpRequestToFuzz (requestObject) {
    let serverName = requestObject.serverName ? requestObject.serverName : LOCALHOST;
    let host = serverName + COLON + requestObject.serverPort
    return {
        url: requestObject.protocol + COLON_SLASH_SLASH + host  + requestObject.url,
        method: requestObject.method,
        data: requestObject.body,
        headers: requestObject.headers,
        timeout: 5000,
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false })
    };
}



/**
 * set the handler logger
 * @param {*} l
 */
function setLogger (l) {
    logger = l;
};

/**
 * Sets the last fuzz event time epoch
 * @param {Number} time
 */
function setLastFuzzEnventTime (time = Date.now()) {
    if (isWorkerSupported()) {
        process.env[CSEC_LAST_FUZZ_REQUEST_TIME] = time;
    } else {
        lastFuzzEventTime = time;
    }
}

/**
 * Returns last fuzz event time epoch
 * @returns {Number} lastFuzzEventTime
 */
function getLastFuzzEnventTime () {
    return isWorkerSupported() ? Number.parseInt(process.env[CSEC_LAST_FUZZ_REQUEST_TIME]) : lastFuzzEventTime;
}

module.exports = {
    handler,
    setLogger,
    setLastFuzzEnventTime,
    getLastFuzzEnventTime
};
