const logs = require('./logging');
const logger = logs.getLogger();
const commonUtils = require('./commonUtils');
const { EMPTY_STR, APPLICATION_JSON, APPLICATION_XML, APPLICATION_X_FORM_URLENCODED } = require('./sec-agent-constants');
const API = require('../../../nr-security-api');
const NRAgent = API.getNRAgent();
const lodash = require('lodash');
const querystring = require('querystring');
const xmlParser = require('fast-xml-parser');

function isValuePresentInAccountIds(value) {
    const accountIdValues = NRAgent.config.security.restriction_criteria.account_info.account_id_values;
    logger.debug("accountIdValues:", accountIdValues);
    let indexOfValue = accountIdValues.indexOf(value);
    if (indexOfValue == -1) {
        return false;
    } else {
        return true;
    }
}

function checkForAccountRestrictionToQuery(request) {
    let restrictQueryFlag = false;
    if (!NRAgent.config.security.restriction_criteria.mapping_parameters.query.enabled) {
        return restrictQueryFlag;
    }
    try {
        const queryMappingParametersList = NRAgent.config.security.restriction_criteria.mapping_parameters.query.location;
        let queryString = request.url.split('?')[1];
        const parsedQueryString = querystring.parse(queryString);
        for (let index = 0; index < queryMappingParametersList.length; index++) {
            const element = queryMappingParametersList[index];
            if (parsedQueryString[element] && isValuePresentInAccountIds(parsedQueryString[element])) {
                restrictQueryFlag = true;
                break;
            }
        }
    } catch (error) {
        logger.error("Error while cheking account restriction to query", error);
    }

    logger.debug("restrictQueryFlag:", restrictQueryFlag);
    return restrictQueryFlag;
}

function checkForAccountRestrictionToPath(request) {
    let restrictPathFlag = false;
    if (!NRAgent.config.security.restriction_criteria.mapping_parameters.path.enabled) {
        return restrictPathFlag;
    }
    try {
        let originalString = request.url;
        const modifiedString = originalString.endsWith('/') ? originalString : originalString + '/';
        const accountIdValues = NRAgent.config.security.restriction_criteria.account_info.account_id_values;
        for (let index = 0; index < accountIdValues.length; index++) {
            const element = '/' + accountIdValues[index] + '/';
            if (modifiedString.includes(element)) {
                restrictPathFlag = true;
                break;
            }
        }
    } catch (error) {
        logger.error("Error while cheking account restriction to Path", error);
    }

    logger.debug("restrictPathFlag:", restrictPathFlag);
    return restrictPathFlag;

}

function checkForAccountRestrictionToHeader(request) {
    let restrictHeaderFlag = false;
    if (!NRAgent.config.security.restriction_criteria.mapping_parameters.header.enabled) {
        return restrictHeaderFlag;
    }
    try {
        const headerMappingParametersList = NRAgent.config.security.restriction_criteria.mapping_parameters.header.location;
        const parsedHeaders = request.headers
        for (let index = 0; index < headerMappingParametersList.length; index++) {
            const element = headerMappingParametersList[index];
            if (parsedHeaders[element] && isValuePresentInAccountIds(parsedHeaders[element])) {
                restrictHeaderFlag = true;
                break;
            }
        }
    } catch (error) {
        logger.error("Error while cheking account restriction to header", error);
    }
    logger.debug("restrictHeaderFlag:", restrictHeaderFlag);
    return restrictHeaderFlag;
}

function parseJsonString(jsonString) {
    let jsonObject = {};
    try {
        jsonObject = JSON.parse(jsonString);
    } catch (error) {
        logger.error("Unable to parse json string");
    }
    return jsonObject;
}

function parseXmlString(xmlString) {
    let xmlObject = {};
    if (!xmlString || lodash.isEmpty(xmlString)) {
        return xmlObject
    }
    try {
        const parser = new xmlParser.XMLParser();
        xmlObject = parser.parse(xmlString, {});
    } catch (error) {
        logger.error("Unable to parse xml string", error);
    }
    return xmlObject;
}

function getAllKeyValuePairs(obj, type) {
    let pairMap = new Map();
    let sep = EMPTY_STR;
    function traverse(obj, currentPath = '') {
        for (let [key, value] of Object.entries(obj)) {
            if (currentPath) {
                sep = '.';
            }
            if (obj instanceof Array) {
                key = (type === 'json') ? '[]' : '';
            }
            else {
                key = sep + key;
            }
            const newPath = `${currentPath}${key}`;
            if (typeof value === 'object' && value !== null) {
                traverse(value, newPath);
            } else {
                if (pairMap.has(newPath)) {
                    let existingList = pairMap.get(newPath);
                    existingList.push(value);
                }
                else {
                    pairMap.set(newPath, [value]);
                }
            }
        }
    }
    traverse(obj);
    return pairMap;
}

function isValuePresentInPairMap(bodyMappingParametersList, keyValuePairs) {
    let isValuePresent = false;
    try {
        for (let i = 0; i < bodyMappingParametersList.length; i++) {
            const element = bodyMappingParametersList[i];
            if (keyValuePairs.has(element)) {
                let valueList = keyValuePairs.get(element);
                for (let j = 0; j < valueList.length; j++) {
                    const valuetoRestrict = valueList[j];
                    isValuePresent = isValuePresentInAccountIds(valuetoRestrict);
                    if (isValuePresent) {
                        break;
                    }
                }
            }
        }

    } catch (error) {
        logger.debug("Error while checking value in pairMap", error);
    }
    return isValuePresent;

}

function checkForAccountRestrictionToJsonBody(request) {
    let restrictBodyFlag = false;
    if (!NRAgent.config.security.restriction_criteria.mapping_parameters.body.enabled) {
        return restrictBodyFlag;
    }
    try {
        const jsonBody = parseJsonString(request.body);
        if (!jsonBody) {
            return false;
        }
        let keyValuePairs = getAllKeyValuePairs(jsonBody, type = 'json');
        logger.debug("Generated key value pairs:", keyValuePairs);
        const bodyMappingParametersList = NRAgent.config.security.restriction_criteria.mapping_parameters.body.location;
        restrictBodyFlag = isValuePresentInPairMap(bodyMappingParametersList, keyValuePairs);

    } catch (error) {
        logger.error("Error while parsing incoming http request json body for account restriction:", error);
    }
    logger.debug("restrictBodyFlag:", restrictBodyFlag);
    return restrictBodyFlag;
}

function checkForAccountRestrictionToXmlBody(request) {
    let restrictBodyFlag = false;
    try {
        const xmlData = parseXmlString(request.body);
        if (!xmlData) {
            return false;
        }
        let keyValuePairs = getAllKeyValuePairs(xmlData, type = 'xml');
        logger.debug("Generated key value pairs:", keyValuePairs);
        const bodyMappingParametersList = NRAgent.config.security.restriction_criteria.mapping_parameters.body;
        restrictBodyFlag = isValuePresentInPairMap(bodyMappingParametersList, keyValuePairs);

    } catch (error) {
        logger.error("Error while parsing incoming http request json body for account restriction:", error);
    }
    logger.debug("restrictBodyFlag:", restrictBodyFlag);
    return restrictBodyFlag;
}

function checkForAccountRestrictionToFormBody(request) {
    let restrictBodyFlag = false;
    if (!request && !request.body) {
        return restrictBodyFlag;
    }
    try {
        const bodyMappingParametersList = NRAgent.config.security.restriction_criteria.mapping_parameters.body;
        const parsedBody = querystring.parse(request.body);
        if (lodash.isEmpty(parsedBody)) {
            return restrictBodyFlag;
        }
        for (let index = 0; index < bodyMappingParametersList.length; index++) {
            const element = bodyMappingParametersList[index];
            if (parsedBody[element] && isValuePresentInAccountIds(parsedBody[element])) {
                restrictBodyFlag = true;
                break;
            }
        }
    } catch (error) {
        logger.debug("Error while parsing form url encoded body");
    }
    logger.debug("restrictBodyFlag:", restrictBodyFlag);
    return restrictBodyFlag;
}

function checkForAccountRestrictionToBody(request) {
    let flag = false;
    if (!request && !request.data) {
        return false;
    }
    try {
        const headers = request.headers;
        let contentType = headers['content-type'];
        switch (contentType) {
            case APPLICATION_JSON:
                flag = checkForAccountRestrictionToJsonBody(request);
                break;
            case APPLICATION_X_FORM_URLENCODED:
                flag = checkForAccountRestrictionToFormBody(request);
                break;
            case APPLICATION_XML:
                flag = checkForAccountRestrictionToXmlBody(request);
                break;
        }
    } catch (error) {
        logger.error("Error while parsing incoming http request body for account restriction:", error);
    }
    return flag;
}
function isHttpRequestRestictToAccount(request) {
    const canRestictBasedOnQuery = checkForAccountRestrictionToQuery(request);
    const canRestictBasedOnPath = checkForAccountRestrictionToPath(request);
    const canRestictBasedOnHeader = checkForAccountRestrictionToHeader(request);
    const canRestictBasedOnBody = checkForAccountRestrictionToBody(request);
    return (canRestictBasedOnQuery || canRestictBasedOnPath || canRestictBasedOnHeader || canRestictBasedOnBody);
}

module.exports = {
    isHttpRequestRestictToAccount
}



