/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

let newrelic;
let NRAgent;

/**
 * 
 * @returns NewRelic Agent instance
 */
function getNRAgent(){
    return NRAgent;
}

/**
 * API to set newrelic agent object.
 * @param {*} agent 
 */
function setNRAgent(agent){
    NRAgent = agent;
}

/**
 * API to get security agent
 * @returns Security Agent instanace
 */
function getSecAgent(){
    const Agent = require('../nr-security-agent/lib/core/agent').Agent;
    const csecAgent = Agent.getAgent();
    if(csecAgent){
         return csecAgent;
    }
}

/**
 * API to get status of security agent
 * @returns Security Agent status
 */
function getSecAgentStatus(){
    const Agent = require('../nr-security-agent/lib/core/agent').Agent;
    if(Agent.getAgent()){
        return Agent.getAgent().status.getStatus()
   }
}

/**
 * API to generate security event from the intermediate data
 * @param {*} securityMetadata 
 * @returns security event object
 */
function generateSecEvent(securityMetadata){
   return require('../nr-security-agent/lib/core/sec-util').generateSecEvent(securityMetadata);
}

/**
 * API to send security event 
 * @param {*} secEvent 
 */
function sendEvent(secEvent){
    require('../nr-security-agent/lib/core/sec-util').sendEvent(secEvent);
}

/**
 * API to get logger instance
 * @returns 
 */
function getLogger(){
    return require('../nr-security-agent/lib/core/logging').getLogger();
}
/**
 * API to validate RXSS
 * @param {*} secRequest 
 * @param {*} responseBody 
 * @param {*} responseHeaders 
 * @returns 
 */
function checkForReflectedXSS(secRequest, responseBody, responseHeaders){
    return require('../nr-security-agent/lib/core/xss-utils').checkForReflectedXSS(secRequest, responseBody, responseHeaders);
}

/**
 * API to get security agent policy
 * @returns security agent policy
 */
function getPolicy(){
    return require('../nr-security-agent/lib/core/Policy').getInstance();
}

/**
 * API to generate Exit event
 * @param {*} event 
 */
function generateExitEvent(event){
    require('../nr-security-agent/lib/core/sec-util').generateExitEvent(event);
}

module.exports = {
    newrelic,
    getNRAgent,
    getSecAgent,
    getSecAgentStatus,
    generateSecEvent,
    sendEvent,
    getLogger,
    checkForReflectedXSS,
    getPolicy,
    generateExitEvent,
    setNRAgent
}