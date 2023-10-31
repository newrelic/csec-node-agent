/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

/* eslint-disable no-unused-vars */
const stringify = require('fast-safe-stringify');

const restClient = require('../../restclient');
const { Agent } = require('../../../agent');
const { FuzzFailEvent } = require('../../../FuzzFailEvent');
const { CSEC_HOME_TMP, COLON, NR_CSEC_FUZZ_REQUEST_ID, SLASH, CSEC_SEP } = require('../../../sec-agent-constants');
const LOCALHOST = 'localhost';
const COLON_SLASH_SLASH = '://';
const http = require('http');
const https = require('https');
const IASTUtil = require('./IASTUtils');

require('dns').setDefaultResultOrder('ipv4first')

const {
    IS_LAMBDA_ENV,
    AWS_LAMBDA_FUNCTION_VERSION_ENV_IDENTIFIER } = require('../../../sec-agent-constants');
const statusUtils = require('../../../statusUtils');

const find = `${SLASH}{{NR_CSEC_VALIDATOR_HOME_TMP}}`;
const CSEC_HOME_TMP_CONST = new RegExp(find, 'g');

let logger;
let lastFuzzEventTime = 0;
let iastIntervalConst;
let coolDownIntervalConst;
let additionalCoolDownTime = 0;
let fuzzedApiIDSet = new Set();


/**
 * utility to start IAST Schedular
 */
function startIASTSchedular() {
    Agent.getAgent().client.dispatcher(IASTUtil.generateIASTDataRequest());
    if (iastIntervalConst) {
        clearInterval(iastIntervalConst);
    }
    iastIntervalConst = setInterval(() => {
        let data = IASTUtil.generateIASTDataRequest();
        let currentTime = Date.now();
        let completedListSize = IASTUtil.getCompletedRequestsMap().size;
        let pendingListSize = IASTUtil.getPendingRequestIds().length;
        let timeDiffInSeconds = ((currentTime - lastFuzzEventTime) / 1000);
        logger.trace("Time difference since last fuzz request:", timeDiffInSeconds);
        logger.trace("Completed requests so far:", completedListSize);
        logger.trace("Pending requests so far:", pendingListSize);

        if (timeDiffInSeconds > 5 && additionalCoolDownTime == 0) {
            Agent.getAgent().client.dispatcher(data);
        }
    }, 5000);
}

/**
 * Utility to log scanned apiId
 * @param {*} fuzzHeader 
 */
function logScannedApiId(fuzzHeader, requestURL) {
    try {
        let apiId = fuzzHeader.split(CSEC_SEP)[0]
        if (apiId && !fuzzedApiIDSet.has(apiId) ) {
            fuzzedApiIDSet.add(apiId);
            logger.info("IAST Scan for API %s with ID : %s started.", requestURL, apiId);
        }
    } catch (error) {

    }

}

// handler function to parse fuzz event and prepare fuzz request
function handler(json) {
    setLastFuzzEventTime();
    let rawFuzzRequest = json.arguments[0];
    rawFuzzRequest = rawFuzzRequest.replace(CSEC_HOME_TMP_CONST, CSEC_HOME_TMP);
    let fuzzRequest;
    try {
        fuzzRequest = JSON.parse(rawFuzzRequest);
        fuzzRequest['id'] = json.id;
        IASTUtil.addPendingRequestId(json.id);
    } catch (error) {
        logger.error('Parsing exeception in fuzz request: ', error);
    }
    if (!fuzzRequest) {
        return;
    }
    logger.debug('Fuzz request received::' + JSON.stringify(json));
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
function handleFuzzRequest(fuzzDetails) {
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

            config.headers['nr-csec-parent-id'] = fuzzRequest.id;

            IASTUtil.completedRequestsMapInit(fuzzRequest.id);

            if(fuzzRequest.headers && fuzzRequest.headers[NR_CSEC_FUZZ_REQUEST_ID]){
                logScannedApiId(fuzzRequest.headers[NR_CSEC_FUZZ_REQUEST_ID], fuzzRequest.requestURI)
            }
        

            logger.info('Firing http request:: URL: ' + config.url);

            const response = restClient.fireRequest(config);
            handleFuzzResponse(response, fuzzDetails);
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
 * @param {Promise} response
 * @param {Object} fuzzDetails
 */
function handleFuzzResponse(response, fuzzDetails) {
    const { rawFuzzRequest, fuzzRequest } = fuzzDetails;
    if (response) {
        IASTUtil.removePendingRequestId(fuzzRequest.id);
        response.then(() => {
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
function parseAxiosHttpRequestToFuzz(requestObject) {
    let serverName = requestObject.serverName ? requestObject.serverName : LOCALHOST;
    let host = serverName + COLON + requestObject.serverPort;
    if(requestObject.headers && requestObject.headers['content-length']){
        delete requestObject.headers['content-length'];
    }
    return {
        url: requestObject.protocol + COLON_SLASH_SLASH + host + requestObject.url,
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
function setLogger(l) {
    logger = l;
};

/**
 * Sets the last fuzz event time epoch
 * @param {Number} time
 */
function setLastFuzzEventTime(time = Date.now()) {
    lastFuzzEventTime = time;
}


/**
 * Sets the last fuzz event time epoch
 * @param {Number} time
 */
function setAdditionalCoolDown(timeInSeconds) {
    additionalCoolDownTime = timeInSeconds ? timeInSeconds : 10;
    if (coolDownIntervalConst) {
        clearTimeout(coolDownIntervalConst)
    }
    coolDownIntervalConst = setTimeout(() => {
        additionalCoolDownTime = 0;
    }, timeInSeconds * 1000);
}

module.exports = {
    handler,
    setLogger,
    setLastFuzzEventTime,
    startIASTSchedular,
    setAdditionalCoolDown
};
