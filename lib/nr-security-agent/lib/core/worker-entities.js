/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MESSAGE = 'MESSAGE';
const FLUSH = 'FLUSH';
const BUSY = 'BUSY';
const INACTIVE = 'INACTIVE';
const RECONNECT = 'RECONNECT';
const UPDATE_APPLICATION_INFO = 'UPDATE APPLICATION INFO';
const IC_READY_FOR_EVENTS = 'IC READY FOR EVENTS';
const INITIALIZING_STATUS = 'initializing';
const NONE_STATUS = '';
const RUNNING_STATUS = 'running';
const ENDED_STATUS = 'ended';
const ERROR = 'ERROR';
const OBEY_RECONNECT = 'obey-reconnect';

/**
 * This defines and constructs a worker message.
 * @param {String} type
 * @param {Object} payload
 */
function WorkerMessage (type, payload) {
    this.type = type;
    this.payload = payload;
}

WorkerMessage.prototype = {};
WorkerMessage.prototype.constructor = WorkerMessage;

/**
 * Returns the type of worker message
 */
WorkerMessage.prototype.getType = function getType () {
    return this.type;
};

/**
 * returns the actual payload of message
 */
WorkerMessage.prototype.getPayload = function getPayload () {
    return this.payload;
};

WorkerMessage.TYPE = {
    MESSAGE,
    FLUSH,
    BUSY,
    INACTIVE,
    RECONNECT,
    UPDATE_APPLICATION_INFO,
    IC_READY_FOR_EVENTS,
    ERROR, 
    OBEY_RECONNECT

};

/**
 * parses a Worker thread from simple object
 * @param {Object} obj
 */
WorkerMessage.parseFromObject = function parseFromObject (obj) {
    if (obj && obj.type && obj.payload) {
        return new WorkerMessage(obj.type, obj.payload);
    }

    return false;
};

const WORKER_STATUS = {
    NONE: NONE_STATUS,
    INITIALIZING: INITIALIZING_STATUS,
    RUNNING: RUNNING_STATUS,
    ENDED: ENDED_STATUS
};

module.exports = {
    WorkerMessage,
    WORKER_STATUS
};
