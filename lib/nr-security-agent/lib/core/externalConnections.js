
/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const { BasicInfo } = require('./event');
const applicationInfo = require('./applicationinfo').getInstance();
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const LinkingMetaData = require('./LinkingMetadata');
const logs = require('./logging');
const logger = logs.getLogger();
let externalConnectionUtil =  require('../../../instrumentation-security/core/external-connections');
/**
 * Function Constructor to create object of ExternalConnections event
 * @param {*} fuzzHeader
 */
function ExternalConnections(externalConnections) {
    let externalConnectionEvent = {};
    externalConnectionEvent.jsonName = 'sec-applicatition-external-connections';
    externalConnectionEvent.eventType = 'sec-applicatition-external-connections'; 
    externalConnectionEvent.jsonVersion = applicationInfo.jsonVersion;
    externalConnectionEvent.pid  = applicationInfo.pid;
    externalConnectionEvent.collectorType = applicationInfo.collectorType;
    externalConnectionEvent.language = applicationInfo.language;
    if (NRAgent && NRAgent.config) {
        externalConnectionEvent.accountId = NRAgent.config.account_id;
        externalConnectionEvent.entityGuid = NRAgent.config.entity_guid;
        externalConnectionEvent.linkingMetadata = LinkingMetaData.getLinkingMetadata();
        externalConnectionEvent.linkingMetadata.agentRunId = NRAgent.config.run_id;
    }
    externalConnectionEvent.applicationUUID = applicationInfo.applicationUUID;
    externalConnectionEvent.groupName = applicationInfo.groupName;
    externalConnectionEvent.externalConnections = externalConnections;
    

    return externalConnectionEvent;
}

ExternalConnections.prototype.constructor = ExternalConnections;

function reportExternalConnections() {
    const connectionSet = externalConnectionUtil.getAllExternalConnections();
    const externalConnectionsList = Array.from(connectionSet);
    let exernalConnectionEvent = ExternalConnections(externalConnectionsList);
    logger.debug("exernalConnectionEvent:",JSON.stringify(exernalConnectionEvent));
}

function startExternalConnectionSchedular(){
    setInterval(() => {
        reportExternalConnections();
    }, 10000);
}

module.exports = {
    ExternalConnections,
    reportExternalConnections,
    startExternalConnectionSchedular
};
