/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const _ = require('lodash');

const { SERVER_COMMAND } = require('../../../sec-agent-constants');
const UnsupportedAgentHandler = require('./unsupported-agent-handler');
const StartupHandshakeHandler = require('./startup-handshake-handler');
const FuzzRequestHandler = require('./fuzz-request-handler');
const CollectorPolicyHandler = require('./collector-policy-handler');
const CollectorPolicyErrorHandler = require('./collecotor-policy-error-handler');
const NoOpHandler = require('./no-op-handler');
const WSReconnect = require('./ws-reconnect');

const commandHandlerMap = {
    [SERVER_COMMAND.STARTUP_WELCOME_MSG]: StartupHandshakeHandler,
    [SERVER_COMMAND.UNSUPPORTED_AGENT]: UnsupportedAgentHandler,
    [SERVER_COMMAND.FUZZ_REQUEST]: FuzzRequestHandler,
    [SERVER_COMMAND.COLLECTOR_CONFIG]: CollectorPolicyHandler,
    [SERVER_COMMAND.POLICY_ERROR]: CollectorPolicyErrorHandler,
    [SERVER_COMMAND.OBEY_WS_RECONNECT]: WSReconnect
};

const handle = function handle (json) {
    if (json && json.controlCommand && json.arguments && commandHandlerMap[json.controlCommand]) {
        commandHandlerMap[json.controlCommand].handler.call(this, json);
    } else {
        NoOpHandler.handler.call(this, json);
    }
};

const setLogger = function setLogger (logger) {
    _.forEach(commandHandlerMap, (handler) => {
        handler.setLogger(logger);
    });
    NoOpHandler.setLogger(logger);
};

module.exports = {
    StartupHandshakeHandler,
    FuzzRequestHandler,
    UnsupportedAgentHandler,
    handle,
    setLogger
};
