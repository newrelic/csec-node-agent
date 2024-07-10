
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
const EC2Info = require('./EC2env');

/**
 * Function Constructor to create object of ServiceMapConnections event
 * @param {*} externalConnections
 */
function EnvInfo() {
    let envInfo = {};
    envInfo.jsonName = 'sec-applicatition-env';
    envInfo.eventType = 'sec-applicatition-env';
    envInfo.jsonVersion = applicationInfo.jsonVersion;
    envInfo.timestamp = Date.now();
    envInfo.pid = applicationInfo.pid;
    envInfo.collectorType = applicationInfo.collectorType;
    envInfo.language = applicationInfo.language;
    if (NRAgent && NRAgent.config) {
        envInfo.accountId = NRAgent.config.account_id;
        envInfo.entityGuid = NRAgent.config.entity_guid;
        envInfo.linkingMetadata = LinkingMetaData.getLinkingMetadata();
        envInfo.linkingMetadata.agentRunId = NRAgent.config.run_id;
    }
    envInfo.applicationUUID = applicationInfo.applicationUUID;
    envInfo.groupName = applicationInfo.groupName;


    return envInfo;
}

EnvInfo.prototype.constructor = EnvInfo;

function generateEnvInfo() {
    const envInfo = EnvInfo();
    let collectedData = EC2Info.collectEnvInfo();
    collectedData.then((data) => {
        envInfo.aws = data;
        logger.debug("Collected aws info:",JSON.stringify(envInfo));
    }).catch((err) => {
        logger.error(err);
    });

}

module.exports = {
    generateEnvInfo
};
