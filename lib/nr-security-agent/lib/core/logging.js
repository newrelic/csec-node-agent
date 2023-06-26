/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

'use strict';

const fs = require('fs');

const log4js = require('log4js');
const { ENV: env } = require('../../resources/config');

const INFO = 'info';
const LOG_FILE_SIZE = 50485760 * 10000;
const LOG_PATTERN_OBJ = {
    type: 'pattern',
    pattern: '%[%d[%p][%c][%h][%z]%] %m'
};
const { LOG_DIR } = require('./sec-agent-constants');
let logger;
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();

const logFileName = `${LOG_DIR}node-security-collector.log`;
const initLogFileName = `${LOG_DIR}node-security-collector-init.log`;

function createLogPathIfNotExist (dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (error) {
    }
}

/**
 * Initializes the logger appenders.
 * @param {v4uuid} applicationUUID
 */
function initialize (applicationUUID) {
    const appenders = {};
    appenders.NR_CSEC = {
        type: 'file',
        compress: false,
        layout: LOG_PATTERN_OBJ
    };
    appenders.NR_CSEC_INIT = {
        type: 'file',
        compress: false,
        layout: LOG_PATTERN_OBJ
    };

    const logLevel = NRAgent && NRAgent.config && NRAgent.config.logging.enabled ? NRAgent.config.logging.level : 'info'; 

    try {
        if (!fs.existsSync(LOG_DIR)) {
            createLogPathIfNotExist(LOG_DIR);
        }
    } catch (error) {
    }

    Object.assign(appenders.NR_CSEC, {
        filename: logFileName,
        maxLogSize: LOG_FILE_SIZE,
        backups: 0
    });

    Object.assign(appenders.NR_CSEC_INIT, {
        filename: initLogFileName,
        maxLogSize: LOG_FILE_SIZE,
        backups: 0
    });

    const categories = {
        default: {
            appenders: [
                'NR_CSEC'
            ],
            level: logLevel
        },
        NR_CSEC_INIT: {
            appenders: [
                'NR_CSEC_INIT',
                'NR_CSEC'
            ],
            level: logLevel
        },
    };

    if (env === 'dev' || env === 'trace') {
        appenders.STDOUT = {
            type: 'stdout',
            layout: LOG_PATTERN_OBJ
        };
        categories.default.appenders.push('STDOUT');
        categories.NR_CSEC_INIT.appenders.push('STDOUT');
    }

    log4js.configure({
        appenders: appenders,
        categories: categories,
        disableClustering: true
    });
}

/**
 * sets the logging level of current instance.
 * @param {String} level
 */
function setLevel (level = INFO) {
    level = level.trim();
    if (logger) {
        logger.level = level;
    } else {
        throw new Error('CSEC-Loggers Not yet Initialized!');
    }
}

/**
 * get the logging level of current instance.
 */
function getLevel () {
    if (logger) {
        return logger.level;
    } else {
        throw new Error('CSEC-Loggers Not yet Initialized!');
    }
}

/**
 * Returns an instance of Loggers.
 * Initializes an instace if not instance is
 * already made.
 * @param {v4uuid} applicationUUID
 */
function getLogger (applicationUUID = process.env.applicationUUID) {
    if (logger) {
        return logger;
    }
    if (applicationUUID) {
        initialize(applicationUUID);
        logger = log4js.getLogger('NR_CSEC');
        const initLogger = getInitLogger();
        try {
            fs.chmodSync(`${logFileName}`, 0o777);
            fs.chmodSync(`${initLogFileName}`, 0o777);
        } catch (error) {
            logger.error("Error while setting up permissions on log files", error);
        }
        initLogger.info("[STEP-2] => Generating unique identifier:",applicationUUID )
        if (NRAgent) {
            setLevel(NRAgent.config.logging.level);
        }

        return logger;
    } else {
        throw new Error('applicationUUID is required to initialize loggers.');
    }
}

function reCreateLogger (applicationUUID) {
    initialize(applicationUUID);
    logger = log4js.getLogger('NR_CSEC');
    setLevel(logger.level);
    updateModuleLoggers(logger);
}

function getInitLogger () {
    const initLogger = log4js.getLogger('NR_CSEC_INIT');
    return initLogger;
}



module.exports = {
    getLogger,
    setLevel,
    getLevel,
    getInitLogger,
    reCreateLogger
};
