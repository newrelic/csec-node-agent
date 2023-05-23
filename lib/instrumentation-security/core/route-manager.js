/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Pre-Release
 */


const routeMap = new Map();
/**
 * Utility to set route based on key value pair
 * @param {*} key 
 * @param {*} value 
 */
function setRoute(key, value){
    routeMap.set(key,value);
}

/**
 * Utility to get route corresponding to key
 * @param {*} key 
 * @returns 
 */
function getRoute(key){
    return routeMap.get(key);
}

module.exports={
    getRoute,
    setRoute,
    routeMap
}