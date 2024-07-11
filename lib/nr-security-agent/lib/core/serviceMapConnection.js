
/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */
const applicationInfo = require('./applicationinfo').getInstance();
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const LinkingMetaData = require('./LinkingMetadata');
const logs = require('./logging');
const logger = logs.getLogger();
const ServiceMap = require('../../../instrumentation-security/core/serviceMap');
const { EMPTY_STR } = require('./sec-agent-constants');
/**
 * Function Constructor to create object of ServiceMapConnections event
 * @param {*} externalConnections
 */
function ServiceMapConnections(outBoundConnectionsList, inBoundConnectionsList) {
    let externalConnectionEvent = {};
    externalConnectionEvent.jsonName = 'sec-applicatition-connections';
    externalConnectionEvent.eventType = 'sec-applicatition-connections';
    externalConnectionEvent.jsonVersion = applicationInfo.jsonVersion;
    externalConnectionEvent.timestamp = Date.now();
    externalConnectionEvent.pid = applicationInfo.pid;
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
    externalConnectionEvent.entityGroup = generateEntityGroup();
    externalConnectionEvent.outboundConnections = outBoundConnectionsList;
    externalConnectionEvent.inboundConnections = inBoundConnectionsList;

    return externalConnectionEvent;
}

ServiceMapConnections.prototype.constructor = ServiceMapConnections;

function reportServiceMaps() {
    const outboundConnectionSet = ServiceMap.getAllOutboundConnections();
    const inboundConnectionSet = ServiceMap.getAllInboundConnections();

    const outBoundConnectionsList = Array.from(outboundConnectionSet);
    const inBoundConnectionsList = Array.from(inboundConnectionSet);
    generateEntityGroup();

    let exernalConnectionEvent = ServiceMapConnections(outBoundConnectionsList, inBoundConnectionsList);
    logger.debug("connection reporting:", JSON.stringify(exernalConnectionEvent));
}

function startServiceMapSchedular() {
    setInterval(() => {
        reportServiceMaps();
        ServiceMap.clearConnectionSet();
    }, 10000);
}

/**
 * Utility to calculate entityGroup
 * @returns entityGroup
 */
function generateEntityGroup() {
    let entityGroup = EMPTY_STR;
    try {
        let apiEndpoints = require('../../../instrumentation-security/core/route-manager').getAllAPIEndPoints();
        entityGroup = require('./sha-size-util').getSHA256ForData(JSON.stringify(apiEndpoints));
    } catch (error) {

    }

    return entityGroup;
}

module.exports = {
    ServiceMapConnections,
    reportServiceMaps,
    startServiceMapSchedular
};
