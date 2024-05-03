/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const { BasicInfo } = require('./event');
const applicationInfo = require('./applicationinfo').getInstance();
const { NR_CSEC_FUZZ_REQUEST_ID, CSEC_SEP, EMPTY_STR } = require('./sec-agent-constants');
const LinkingMetaData = require('./LinkingMetadata');
/**
 * Function Constructor to create object of IASTScanFailure event
 * @param {*} fuzzRequest
 */
function IASTScanFailure(fuzzRequest, logMessageException, failureMessage) {
    BasicInfo.call(this);

    this.jsonVersion = applicationInfo.jsonVersion;
    this.jsonName = 'iast-scan-failure';
    this.pid = applicationInfo.pid;
    this.applicationUUID = applicationInfo.applicationUUID;
    this.groupName = applicationInfo.groupName;
    this.policyVersion = applicationInfo.policyVersion;
    this.replayFailure = {
        apiId: getAPIId(fuzzRequest),
        error: logMessageException,
        nrCsecFuzzRequestId: fuzzRequest.headers[NR_CSEC_FUZZ_REQUEST_ID],
        controlCommandId: fuzzRequest['id'],
        failureMessage: failureMessage ? failureMessage : EMPTY_STR
    };
    this.linkingMetadata = LinkingMetaData.getLinkingMetadata();
    this.securityAgentMetaData = {}
}

function getAPIId(fuzzRequest) {
    let apiId = EMPTY_STR;
    try {
        if (fuzzRequest.headers && fuzzRequest.headers[NR_CSEC_FUZZ_REQUEST_ID]) {
            apiId = fuzzRequest.headers[NR_CSEC_FUZZ_REQUEST_ID].split(CSEC_SEP)[0];
        }
    } catch (error) {
    }
    return apiId;

}

IASTScanFailure.prototype.constructor = IASTScanFailure;

module.exports = {
    IASTScanFailure
};
