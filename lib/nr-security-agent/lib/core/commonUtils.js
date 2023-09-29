/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */

/* eslint-disable prefer-promise-reject-errors */
const fs = require('fs');
const uuidV = require('uuid');
const logs = require('./logging');
const logger = logs.getLogger();
const OS = require('os');
const path = require('path');
const checkDiskSpace = require('check-disk-space').default;
const AgentStatus = require('../core/agent-status');
const { LOG_MESSAGES, CSEC_HOME, SLASH } = require('./sec-agent-constants');

const prettyBytes = require('pretty-bytes');
const njsAgentConstants = require('./sec-agent-constants');
const LinkingMetaData = require('./LinkingMetadata');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const lodash = require('lodash')
const backupLogFileRegex = /.log.\d/gm;
let websocketHealth;
/**
 * Utility to generate UUID
 * @returns UUID
 */
function getUUID() {
    let uuid = process.env.applicationUUID || uuidV.v4();
    process.env.applicationUUID = uuid;
    return uuid;
}

function getKindIdPair(identifier, hostId) {
    const obj = {};
    if (identifier.isContainer) {
        obj.first = 'CONTAINER';
        obj.second = identifier.containerId;
    } else if (identifier.isECSContainer) {
        obj.first = 'ECS';
        obj.second = identifier.ecsTaskId;
    } else if (identifier.isPod) {
        obj.first = 'CONTAINER';
        obj.second = identifier.podId;
    } else {
        obj.first = 'HOST';
        obj.second = hostId;
    }
    return obj;
}

/**
 * Utility to check worker thread support
 * @returns 
 */
function hasWorker() {
    let workerFlag = false;
    try {
        require('worker_threads');
        workerFlag = true;
    } catch (error) {
        workerFlag = false;
    }
    return workerFlag;
}

function runtimeSupportsFunctionGenerators() {
    try {
        // eslint-disable-next-line no-eval
        eval('"use strict"; (function* () {})');
        process.csecRuntimeSupportsFunctionGenerators = true;
    } catch (err) {
        process.csecRuntimeSupportsFunctionGenerators = false;
    }
    return process.csecRuntimeSupportsFunctionGenerators;
}

function runtimeSupportsAsyncFunctionGenerators() {
    try {
        // eslint-disable-next-line no-eval
        eval('"use strict"; (async function* () {})');
        process.csecRuntimeSupportsAsyncFunctionGenerators = true;
    } catch (err) {
        process.csecRuntimeSupportsAsyncFunctionGenerators = false;
    }
    return process.csecRuntimeSupportsAsyncFunctionGenerators;
}

/**
 * Utility to create directory and set permissions
 * @param {*} dir 
 */
function createPathIfNotExist(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, 777, { recursive: true });
            logger.info(dir + ' Created');
            fs.chmodSync(dir, 0o777);
        } else {
            fs.chmodSync(dir, 0o777);
            logger.debug(dir + ' Already Exists');
        }
    } catch (error) {
        logger.debug(dir + ' Not Created', error);
    }
}

/**
 * Utility to get OS
 * @returns 
 */
function getOS() {
    if (process.platform === 'darwin') {
        return 'mac';
    }
    if (process.platform === 'win32') {
        return 'windows';
    } else {
        return 'linux';
    }
}

/**
 * Utility to create directories
 */
function createDirectories() {
    createPathIfNotExist(`${CSEC_HOME}${SLASH}nr-security-home`);
    createPathIfNotExist(`${CSEC_HOME}${SLASH}nr-security-home${SLASH}logs`);
    createPathIfNotExist(`${CSEC_HOME}${SLASH}nr-security-home${SLASH}logs${SLASH}snapshots`);
    createPathIfNotExist(`${CSEC_HOME}${SLASH}nr-security-home${SLASH}tmp`);
    createPathIfNotExist(`${CSEC_HOME}${SLASH}nr-security-home${SLASH}tmp${SLASH}language-agent`);
    createPathIfNotExist(`${CSEC_HOME}${SLASH}nr-security-home${SLASH}tmp${SLASH}language-agent${SLASH}${getUUID()}`);
    createPathIfNotExist(`${CSEC_HOME}${SLASH}nr-security-home${SLASH}tmp${SLASH}language-agent${SLASH}${getUUID()}${SLASH}ds-tmp`);
    try {
        fs.chmodSync(`${CSEC_HOME}${SLASH}nr-security-home`, 0o777);
    } catch (error) {
    }
}
/**
 * Utility to check init setup and disk space
 */
async function initialSetup() {
    try {
        createDirectories();
    } catch (err) {
        logger.error(err);
    }
}

/**
 * Utility function to check if the logfile is accessible or not.
 */
function isLogAccessible(logFileName) {
    return new Promise((resolve) => {
        if (logFileName === njsAgentConstants.STATUS_LOG_FILE && require('./statusUtils').getBufferedHC().length === 0) {
            resolve('OK');
        }
        fs.access(logFileName, fs.constants.F_OK | fs.constants.W_OK, (err) => {
            if (err) {
                resolve('Error');
            }
            else if ((!logs.isLoggerOk || logger.level.levelStr == 'OFF') && logFileName != njsAgentConstants.STATUS_LOG_FILE) {
                resolve('Error');
            }
            else {
                resolve('OK');
            }
        });
    }).catch(() => {
    });
}


/**
 * Utility function to get CPU Usage in percentage
 * @param {*} oldUsage
 */
function getCpuUsage() {
    const usageObj = process.cpuUsage();
    const userUsage = usageObj.user / (usageObj.user + usageObj.system);
    return userUsage;
}

/**
 * Utility to convert Bytes to MB
 * @param {*} bytes
 * @param {*} decimals
 */
function formatBytesToMB(bytes, decimals = 2) {
    return parseFloat((bytes / (1024 * 1024)).toFixed(decimals));
}

/**
 * Utility to get diskSpace infor for the give path
 * @param {*} path
 */
async function getDiskSpace(path) {
    try {
        const x = await checkDiskSpace(path).catch(() => { });
        return x;
    } catch (error) {
        logger.error("Error in getting diskpace:", error)
    }
}

/**
 * Utility to get HC stats
 */
async function getHCStats() {
    const stats = {};
    try {
        const appInfo = require('./applicationinfo').getInstance();
        const rootDiskSpace = await getDiskSpace(path.parse(process.cwd()).root);
        if (appInfo && appInfo.serverInfo && appInfo.serverInfo.deployedApplications[0] && appInfo.serverInfo.deployedApplications[0].deployedPath) {
            const processDirDiskFreeSpace = await getDiskSpace(appInfo.serverInfo.deployedApplications[0].deployedPath);
            if (processDirDiskFreeSpace) {
                stats.processDirDiskFreeSpaceMB = formatBytesToMB(processDirDiskFreeSpace.free);
            }
        }
        const memoryObj = process.memoryUsage();
        if (rootDiskSpace) {
            stats.rootDiskFreeSpaceMB = formatBytesToMB(rootDiskSpace.free);
        }

        stats.processHeapUsageMB = formatBytesToMB(memoryObj.heapUsed);
        stats.processRssMB = formatBytesToMB(memoryObj.rss);
        stats.processMaxHeapMB = formatBytesToMB(memoryObj.heapTotal);
        stats.systemFreeMemoryMB = formatBytesToMB(OS.freemem());
        stats.systemTotalMemoryMB = formatBytesToMB(OS.totalmem());
        stats.nCores = OS.cpus().length;
        stats.processCpuUsage = parseFloat(getCpuUsage().toFixed(2));
        stats.systemCpuLoad = parseFloat(OS.loadavg()[1].toFixed(2));
    } catch (error) {
        logger.error('Error in generating stats:', error);
    }
    return stats;
}
/**
 * Utility to check Agent status
 */
function isAgentActiveState() {
    if (AgentStatus.getInstance().getStatus() === AgentStatus.CSECAgentStatus.codes.ACTIVE && (NRAgent ? (NRAgent.config.security.enabled && NRAgent.canCollectData()) : true) && getWSHealthStatus() == 'OK') {
        return 'OK';
    } else {
        return 'Error';
    }
}

function iastRestClientStatus() {
    return 'OK';
}
/**
 * Utiltity to remove older snapshots
 */
function removeOlderSnapshots() {
    try {
        const basePath = njsAgentConstants.LOG_DIR + 'snapshots' + SLASH;
        const directoryContent = fs.readdirSync(basePath);
        const files = directoryContent.filter((filename) => {
            return fs.statSync(`${basePath}${SLASH}${filename}`).isFile();
        });
        const sorted = files.sort((a, b) => {
            const firstStat = fs.statSync(`${basePath}${SLASH}${a}`);
            const secondStat = fs.statSync(`${basePath}${SLASH}${b}`);
            return new Date(secondStat.mtime).getTime() - new Date(firstStat.mtime).getTime();
        });
        for (let i = 99; i < sorted.length; i++) {
            const fileToDelete = basePath + sorted[i];
            try {
                fs.unlink(fileToDelete, (err) => {
                    if (err) {
                        logger.error(err);
                    } else {
                        logger.debug('Snapshot deleted:', fileToDelete);
                    }
                });
            } catch (error) {
                logger.error(error);
            }
        }
    } catch (error) {
        logger.debug(error);
    }
}
/**
 * Utilty to remove older log files.
 */
function removeOlderlogfiles() {
    try {
        const basePath = njsAgentConstants.LOG_DIR;
        const directoryContent = fs.readdirSync(basePath);
        // eslint-disable-next-line array-callback-return
        const files = directoryContent.filter((filename) => {
            if (filename.match(backupLogFileRegex)) {
                return fs.statSync(`${basePath}${SLASH}${filename}`).isFile();
            }
        });
        const sorted = files.sort((a, b) => {
            const firstStat = fs.statSync(`${basePath}${SLASH}${a}`);
            const secondStat = fs.statSync(`${basePath}${SLASH}${b}`);
            return new Date(secondStat.mtime).getTime() - new Date(firstStat.mtime).getTime();
        });
        let maxLogfile = process.env.NR_CSEC_DEBUG_LOGFILE_MAX_COUNT;
        if(isNaN(maxLogfile)){
            maxLogfile = 2;
        }
        for (let i = maxLogfile; i < sorted.length; i++) {
            const fileToDelete = basePath + sorted[i];
            try {
                fs.unlink(fileToDelete, (err) => {
                    if (err) {
                        logger.error(err);
                    } else {
                        logger.debug('Logfile deleted:', fileToDelete);
                    }
                });
            } catch (error) {
                logger.error(error);
            }
        }
    } catch (error) {
        logger.debug(error);
    }
}

/**
 * utilty to roll over the log file. Not in use
 */
function logRollOver() {
    const logFileName = `${njsAgentConstants.LOG_DIR}node-security-collector.log`;
    try {
        const stats = fs.statSync(logFileName);
        if (stats.size < 50485760) {
            return;
        }
    } catch (error) {
        logger.debug('Error in getting stats of log file:', error.message);
        return;
    }

    try {
        const lockFile = `${njsAgentConstants.LOG_DIR}lock-file.lock`;
        const pid = process.pid;
        if (!fs.existsSync(lockFile)) {
            fs.writeFileSync(lockFile, pid.toString());
        }
        const fileData = fs.readFileSync(lockFile).toString();
        if (pid.toString() === fileData) {
            try {
                const newLogFile = logFileName + '.' + Date.now();
                fs.copyFileSync(logFileName, newLogFile);
                fs.truncateSync(logFileName);
                logger.info('logfile rolled over successfully', newLogFile);
                removeOlderlogfiles();
            } catch (error) {
                logger.error(error);
            }
        }
        fs.unlinkSync(lockFile);
    } catch (error) {
        logger.error(error);
    }
}

/**
 * Utility to get validator service endpoint
 * @returns 
 */
function getValidatorServiceEndpointURL() {
    let validatorServiceEndpointURL = NRAgent ? NRAgent.config.security.validator_service_url : "wss://csec.nr-data.net";
    if (lodash.isEmpty(validatorServiceEndpointURL)) {
        validatorServiceEndpointURL = "wss://csec.nr-data.net";
    }
    return validatorServiceEndpointURL
}

/**
 * Utility to get security mode
 * @returns 
 */
function getCSECmode() {
    const mode = NRAgent ? NRAgent.config.security.mode : 'IAST';
    return mode
}

/**
 * Utility to get path of CA Cert
 * @returns 
 */
function getPathOfCACert() {
    let relativePath = path.resolve(__dirname, '../../resources/cert.pem');
    if (process.platform == 'win32') {
        relativePath = path.resolve(__dirname, '..\\..\\resources\\cert.pem');
    }
    const certPath = NRAgent && NRAgent.config.security.ca_bundle_path ? NRAgent.config.security.ca_bundle_path : relativePath;
    return certPath
}
/**
 * Setting ws health status
 * @param {*} status 
 */
function setWSHealthStatus(status) {
    websocketHealth = status;
}

/**
 * Returns value of websocketHealth
 * @returns websocketHealth
 */
function getWSHealthStatus() {
    if (!websocketHealth) {
        return 'Error';
    }
    else {
        return websocketHealth;
    }
}

module.exports = {
    getUUID,
    getKindIdPair,
    hasWorker,
    runtimeSupportsFunctionGenerators,
    runtimeSupportsAsyncFunctionGenerators,
    createPathIfNotExist,
    getOS,
    initialSetup,
    createDirectories,
    isLogAccessible,
    getCpuUsage,
    getHCStats,
    isAgentActiveState,
    iastRestClientStatus,
    removeOlderSnapshots,
    logRollOver,
    getValidatorServiceEndpointURL,
    getCSECmode,
    getPathOfCACert,
    getWSHealthStatus,
    setWSHealthStatus
};
