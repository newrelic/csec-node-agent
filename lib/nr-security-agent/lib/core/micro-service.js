/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const { EMPTY_STR, SEMICOLON, CSEC_SEP, FORWARDSLASH } = require("./sec-agent-constants");
const logs = require('./logging');
const logger = logs.getLogger();
let generatedEventsMap = new Map();
const LinkingMetaData = require('./LinkingMetadata');
const crypto = require('crypto');
const secUtils = require('./sec-util');
let hashedEntityGuid = EMPTY_STR;

function addGeneratedEvents(applicationUUID, parentId, eventId) {
    let generatedEventobject = generatedEventsMap.get(applicationUUID);
    if (generatedEventobject && parentId !== EMPTY_STR && eventId !== EMPTY_STR) {
        generatedEventobject.set(parentId, eventId)
    }
    generatedEventsMap.set(applicationUUID, generatedEventobject);
}

function generatedEventsInit(applicationUUID) {
    generatedEventsMap.set(applicationUUID, new Map());
}

function getGeneratedEventsMap(){
    return generatedEventsMap;
}

function applicationUUIDFromTraceHeader(traceHeader) {
    let firstServiceHeaderUUID = EMPTY_STR;
    try {
        let firstServiceHeader = traceHeader.split(SEMICOLON)[0];
        firstServiceHeaderUUID = firstServiceHeader.split(FORWARDSLASH)[0];
    } catch (error) {
        logger.debug("Unable to get applicationUUID from trace header", error);
    }
    return firstServiceHeaderUUID;
}

function prepareGeneratedEventforIncomingReq(csecFuzzHeader, csecParentId, csecTracingHeader) {
    if (csecFuzzHeader) {
        let guidSHA256 = secUtils.getAPIID(csecFuzzHeader.split(CSEC_SEP)[0]).guid;
        let linkingMetadata = LinkingMetaData.getLinkingMetadata();
        let entityGuid = linkingMetadata['entity.guid'];
        let verified = verfiyGUID(entityGuid, guidSHA256);
        if(!verified){
            return;
        }
    }
    let firstServiceHeaderUUID = applicationUUIDFromTraceHeader(csecTracingHeader);
    generatedEventsInit(firstServiceHeaderUUID);
}


function verfiyGUID(entityGuid, guidSHA256) {
    let verifyFlag = false;
    try {
        const hash = getHashedEntityGUID(entityGuid);
        if (hash == guidSHA256) {
            verifyFlag = true;
        }
    } catch (error) {
        logger.debug("Error while verifying entityGuid SHA", error);
    }

    return verifyFlag;
}

function getHashedEntityGUID(entityGuid){
    if(hashedEntityGuid!=EMPTY_STR){
        return hashedEntityGuid;
    }
    try {
        const sha256Hash = crypto.createHash('sha256');
        sha256Hash.update(entityGuid);
        hashedEntityGuid = sha256Hash.digest('hex');
    } catch (error) {
        logger.debug("Error while calculated sha256 of entity Guid", error);
    }
    return hashedEntityGuid;

}

module.exports = {
    prepareGeneratedEventforIncomingReq,
    addGeneratedEvents,
    getGeneratedEventsMap
}