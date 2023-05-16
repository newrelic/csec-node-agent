/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const WebSocket = require('ws');
const RingBuffer = require('ringbufferjs');
const stringify = require('fast-safe-stringify');
const { EventEmitter } = require('events');

const { Agent } = require('../../agent');
const logs = require('../../logging');
const hc = require('../../health-check');
const fs = require('fs');
const path = require('path');
const { promisify } = require('../../sec-util');
const ResponseHandler = require('./response');
const { EMPTY_APPLICATION_UUID, LOG_MESSAGES } = require('../../sec-agent-constants');
const statusUtils = require('../../statusUtils');
const commonUtils = require('../../commonUtils');

const BUSY = 'busy';
const IDLE = 'idle';
const CONNECTING = 'connecting';
const WS_ON_OPEN = 'open';
const WS_ON_MSG = 'message';
const WS_ON_ERR = 'error';
const ACK = 'ACK';
const INIT_PING_RETRY_DELAY_ON_FAIL = 200; // in ms
const RECONNECTION_DELAY = 500; // ms
const APPLICATION_INFO_JSON_NAME = 'applicationinfo';
let APP_INFO;

const queue = new RingBuffer(1000);
let logger = logs.getLogger();
const initLogger = logs.getInitLogger();
let webSocket;
let pingIntervalConst;
let initTimeOut;

/**
 * defines the WebSocket callbacks object
 *
 * @param {Function} onOpen
 * @param {Function} onMessage
 * @param {Function} onError
 */
function WSCallbacks(onOpen, onMessage, onError) {
    this.onOpen = onOpen;
    this.onMessage = onMessage;
    this.onError = onError;
}




/**
 * This defines the websocket and related
 * methods
 *
 * @param {String} uri - to connect to
 * @param {WSCallbacks} callbacks - on open, on message and on error callbacks
 */
function SecWebSocket(uri, callbacks = {}, logr = null) {
    this.instance = undefined;
    this.isICReadyForEvents = false;
    this.uri = uri;
    this.event = new EventEmitter();
    this.openCB = (callbacks.onOpen || defaultOnOpenCB()).bind(this);
    this.msgCB = (callbacks.onMessage || defaultOnMsgCB()).bind(this);
    this.errCB = (callbacks.onError || defaultOnErrCB()).bind(this);
    logger = logr || logger;
    this.wsRetryCount = 0;
    this.init();
}

SecWebSocket.prototype = {};
SecWebSocket.prototype.constructor = SecWebSocket;


/**
 * Initiates a new web socket connection.
 */
SecWebSocket.prototype.init = function init() {
    if (webSocket) {
        try {
            webSocket.removeAllListeners('open');
            webSocket.removeAllListeners('close');
            webSocket.removeAllListeners('message');
            webSocket.terminate();
        } catch (error) {
            logger.debug("Error while terminating webSocket instance", error);
        }
    }
    setWebSocketConn();
    this.setValidatorNotReadyForEvents();
    const validatorService = commonUtils.getValidatorServiceEndpointURL();
    const authHeaders = require('../../Auth-headers').getInstance();
    let cert = ''
    try {
        const certPath = commonUtils.getPathOfCACert();
        cert = fs.readFileSync(certPath, 'utf8');
    } catch (error) {
        logger.error("Error in reading certificate:", error);
    }

    webSocket = new WebSocket(validatorService, null, { headers: authHeaders, cert: cert });

    webSocket.on(WS_ON_OPEN, this.openCB);
    webSocket.on(WS_ON_MSG, this.msgCB);
    webSocket.on(WS_ON_ERR, this.errCB);
    this.instance = webSocket;
};

/**
 * Re-initiates the websocket by disconnecting
 * and initiating a new websoc connection.
 */
SecWebSocket.prototype.reconnect = function reconnect() {
    const { instance } = this;

    if (instance.readyState === WebSocket.CONNECTING &&
        process.env.CSEC_WS_STATE === CONNECTING) {
        return;
    }
    setWebSocketConn();
    this.setValidatorNotReadyForEvents();

    if (instance.readyState === WebSocket.OPEN) {
        this.openCB();
        return;
    }
    process.env.WS_HEALTH = 'Error';
    logger.debug(LOG_MESSAGES.DETECTED_BROKEN_CONN);
    this.obeyReconnect();

};

SecWebSocket.prototype.obeyReconnect = function obeyReconnect() {
    const { instance } = this;
    if(initTimeOut){
        clearTimeout(initTimeOut);
    }
    
    initTimeOut = setTimeout(() => {
        logger.debug("Terminating ws instance and reconnecting");
        try {
            instance.terminate();
        } catch (err) {
            logger.debug("Error while terminating ws instance");
        }
        this.init();
    }, 15000)

}

SecWebSocket.prototype.pingWS = async function pingWS() {
    const self = this;
    try {
        await promisify(self.instance, self.instance.ping)(ACK, true, function (err) {
            if (err) {
                logger.debug("Error while pinging:", err);
                self.obeyReconnect();
            }
        });
    } catch (err) {
        logger.debug("error in ping:", err);
        statusUtils.addErrortoBuffer(err);
        return;
    }
}

/**
 * sends the event over the websocket instance.
 * @param {JSON} event
 */
SecWebSocket.prototype.dispatch = async function dispatch(event) {
    if (event.jsonName === APPLICATION_INFO_JSON_NAME) {
        APP_INFO = event;
    }
    RegExp.prototype.toJSON = RegExp.prototype.toString;
    const eventStr = stringify(event);
    if (!this.instance ||
        this.instance.readyState !== WebSocket.OPEN ||
        !this.isICReadyForEvents
    ) {
        handleDispatchFailure(this, event, eventStr);
        return;
    }
    try {
        aquireWebSocket();
        logger.debug(LOG_MESSAGES.EVENT_SENT + eventStr);
        await promisify(this.instance, this.instance.send)(eventStr, { mask: true });
        releaseWebSocket();
    } catch (error) {
        logger.debug(LOG_MESSAGES.ERROR_WHILE_SEND_EVENT, eventStr, error);
        statusUtils.addErrortoBuffer(error);
        handleDispatchFailure(this, event, eventStr);
    }
};

/**
 * sends the applicationInfor over the websocket instance.
 * @param {JSON} applicationInfoJSON
 */
SecWebSocket.prototype.dispatchApplicationInfo = async function dispatchApplicationInfo(applicationInfoJSON) {
    const eventStr = stringify(applicationInfoJSON);
    if (applicationInfoJSON.applicationUUID === EMPTY_APPLICATION_UUID) {
        throw new Error('ApplicationInfo not completely Initialized, No application identification detail found!');
    }
    if (this.instance.readyState !== WebSocket.OPEN) {
        logger.warn('Tried to send ApplicationInfo when socket was not open');
    }
    try {
        await promisify(this.instance, this.instance.send)(eventStr, { mask: true });
    } catch (error) {
        statusUtils.addErrortoBuffer(error);
        logger.warn('Error while sending applicationInfo:', error);
        this.obeyReconnect();
    }
};



/**
 * this sets the isICReadyForEvents property
 */
SecWebSocket.prototype.setICReadyForEvents = function setICReadyForEvents() {
    this.isICReadyForEvents = true;
};

/**
 * this unsets the isICReadyForEvents property
 */
SecWebSocket.prototype.setValidatorNotReadyForEvents = function setValidatorNotReadyForEvents() {
    this.isICReadyForEvents = false;
};

/**
 * This would flush all the events out of
 * event queue and publish to IC.
 *
 * If the send fails there is no way to
 * recover these events.
 */
SecWebSocket.prototype.flushEventQueue = async function flushEventQueue() {
    aquireWebSocket();
    try {
        const sentEvents = [];
        for (let counter = 0; counter < queue.size(); counter += 1) {
            hc.getInstance().registerEventProcessed();
            sentEvents.push(promisify(this.instance, this.instance.send)(queue.deq(), { mask: true }));
        }
        const results = await Promise.all(sentEvents);
        hc.getInstance().registerEventsSent(results.length);
    } catch (err) {
        statusUtils.addErrortoBuffer(err);
        logger.error('Flush failed, reception of all events on IC couldn\'t be ensured.');
    } finally {
        releaseWebSocket();
    }
};

/**
 * this handles the event dispatch failure
 *
 * @param {SecWebSocket} self
 * @param {String} eventStr
 */
const handleDispatchFailure = (self, event, eventStr) => {
    // we would want to drop applicationinfo events as the latest
    // applicationinfo would anyway be relayed on reconnection
    // so feeding an old applicationinfo JSON would be incorrect
    if (eventStr && event.jsonName !== APPLICATION_INFO_JSON_NAME) {
        hc.getInstance().registerEventDrop();
        queue.enq(eventStr);
    }
    process.env.WS_HEALTH = 'Error';
    // If the reconnection is not already in progress
    // we would want to reconnect to IC
    // self.reconnect();
};

/**
 * This is the websocket on open default listener
 * generator.
 *
 * If we fail to ping the ws server, we
 * will retry sending the init ping after a
 * defined delay.
 * Otherwise if the ping is successful we will
 * dispatch the application info.
 *
 * @param {SecWebSocket} self
 */
const defaultOnOpenCB = () => async function onOpen() {
    const self = this;
    if (self.isICReadyForEvents) {
        return;
    }
    if (self.instance.readyState !== WebSocket.OPEN) {
        self.reconnect();
        return;
    }
    if (pingIntervalConst) {
        clearInterval(pingIntervalConst);
    }
    pingIntervalConst = setInterval(() => {
        self.pingWS();
    }, 30000)
    const validatorService = commonUtils.getValidatorServiceEndpointURL();
    initLogger.info(`[STEP-4] => Web socket connection to SaaS validator established successfully at ${validatorService}`)
    try {

        this.wsRetryCount = 0;
        process.env.WS_HEALTH = 'OK';

        const applicationInfo = APP_INFO || Agent.getAgent().applicationInfo;
        await self.dispatchApplicationInfo(applicationInfo);

        // by now we expect IC to be ready
        aquireWebSocket(true);
        self.setICReadyForEvents();
        // we would also want the event queue to be flushed
        await self.flushEventQueue();
        ResponseHandler.FuzzRequestHandler.setLastFuzzEnventTime();
        releaseWebSocket();
        initLogger.info(LOG_MESSAGES.SENDING_APPINFO_COMPLETE, JSON.stringify(applicationInfo)); 
    } catch (err) {
        logger.error(`Connection broken: ${err.message}`);
        statusUtils.addErrortoBuffer(err);
        process.env.WS_HEALTH = 'Error';
        setWebSocketConn();
        self.setValidatorNotReadyForEvents();
        setTimeout(self.openCB, INIT_PING_RETRY_DELAY_ON_FAIL);
    }
};

/**
 * This is the websocket on error default listener
 * generator.
 *
 * This will close and re-establish the websocket
 * connection once if invoked.
 *
 * @param {SecWebSocket} self
 */
const defaultOnMsgCB = () => function onMessage(data) {
    const json = JSON.parse(data);
    ResponseHandler.handle(json);
};

/**
 * This is the websocket on error default listener
 * generator.
 *
 * This will close and re-establish the websocket
 * connection once if invoked.
 *
 * @param {SecWebSocket} self
 */
const defaultOnErrCB = (error) => function onClose(error) {
    const self = this;
    if (error && error.code && (error.code === 'ECONNREFUSED' || error.code === 'EPIPE' || error.code === 'ECONNRESET')) {
        logger.debug("WS Client Error callback called:", error);
        self.obeyReconnect();
    }
    else {
        aquireWebSocket(true);
        self.reconnect();
    }
    statusUtils.addErrortoBuffer(new Error('Error connecting to websocket'));
    process.env.WS_HEALTH = 'Error';
};

SecWebSocket.Events = {
    BUSY,
    IDLE,
    CONNECTING
};

SecWebSocket.States = {
    BUSY,
    IDLE,
    CONNECTING
};
SecWebSocket.PING_MSG = ACK;
SecWebSocket.PING_RETRY_INTERVAL = INIT_PING_RETRY_DELAY_ON_FAIL;
SecWebSocket.RECONNECTION_DELAY = RECONNECTION_DELAY;

/**
 * Checks if the websocket is currently busy
 * by checking on CSEC_WS_STATE
 *
 * @returns {boolean} busy
 */
function isWebSocketBusy() {
    return process.env.CSEC_WS_STATE !== IDLE;
}

/**
 * Sets the websocket state as connecting
 */
function setWebSocketConn() {
    process.env.CSEC_WS_ACQUIRED_COUNT = 0;
    process.env.CSEC_WS_STATE = CONNECTING;
}

/**
 * marks the WS being aquired to be used in an operation
 */
function aquireWebSocket(forced = false) {
    if (!forced && process.env.CSEC_WS_STATE === CONNECTING) return;

    let count = Number.parseInt(process.env.CSEC_WS_ACQUIRED_COUNT);
    count += 1;
    process.env.CSEC_WS_ACQUIRED_COUNT = count;
    process.env.CSEC_WS_STATE = BUSY;
}

/**
 * marks the WS being released after use in an operation
 */
function releaseWebSocket() {
    const { CSEC_WS_STATE, CSEC_WS_ACQUIRED_COUNT } = process.env;
    let count = Number.parseInt(CSEC_WS_ACQUIRED_COUNT);
    count = count > 0 ? count - 1 : 0;
    process.env.CSEC_WS_ACQUIRED_COUNT = count;
    process.env.CSEC_WS_STATE = count === 0 && CSEC_WS_STATE !== CONNECTING ? CSEC_WS_STATE : IDLE;
}

module.exports = {
    WSCallbacks,
    SecWebSocket,
    isWebSocketBusy,
    setWebSocketConn,
    aquireWebSocket,
    releaseWebSocket
};
