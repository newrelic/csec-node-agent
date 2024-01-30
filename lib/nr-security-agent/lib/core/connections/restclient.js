/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

const axios = require('axios').default;

/**
 * fire http request based on provided config 
 * @param {*} config 
 * @returns 
 */
function fireRequest (config) {
    axios.defaults.timeout = 5000;
    return axios(config);
}

module.exports = {
    fireRequest
};
