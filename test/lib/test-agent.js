/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: New Relic Software License v1.0
 */

'use strict'

/*
 * Local replacement for @newrelic/test-utilities' TestAgent.
 * Builds directly on the `newrelic` package (already a devDependency),
 * reproducing only the behaviors this repo's tests actually use:
 * makeInstrumented, getShim, unload, runInTransaction.
 */

const Agent = require('newrelic/lib/agent')
const API = require('newrelic/api')
const configurator = require('newrelic/lib/config')
const shimmer = require('newrelic/lib/shimmer')
const Shim = require('newrelic/lib/shim/shim')

function removeListenerByName(emitter, event, name) {
    for (const listener of emitter.listeners(event)) {
        if (listener instanceof Function && listener.name === name) {
            emitter.removeListener(event, listener)
        }
    }
}

class TestAgent {
    constructor(conf, setState = true) {
        const config = configurator.createInstance(conf)
        config.debug = config.debug || {}
        config.debug.double_linked_transactions = true
        config.applications = () => ['csec-node-agent tests']

        this.agent = new Agent(config)
        this._contextManager = this.agent._contextManager

        if (setState) {
            this.agent.setState('started')
        }
    }

    static makeInstrumented(conf, setState) {
        const helper = new TestAgent(conf, setState)
        helper.instrument()
        return helper
    }

    instrument() {
        shimmer.debug = true
        shimmer.patchModule(this.agent)
        shimmer.bootstrapInstrumentation(this.agent)
        return this
    }

    unload() {
        shimmer.unpatchModule()
        shimmer.unwrapAll()
        shimmer.debug = false
        shimmer.registeredInstrumentations = Object.create(null)

        removeListenerByName(process, 'uncaughtException', '__NR_uncaughtExceptionHandler')
        removeListenerByName(process, 'unhandledRejection', '__NR_unhandledRejectionHandler')
    }

    runInTransaction(type, func) {
        if (typeof type === 'function') {
            func = type
            type = null
        }
        return this.agent.tracer.transactionProxy(() => func(this.agent.getTransaction()))()
    }

    getShim() {
        if (!this._shim) {
            this._shim = new Shim(this.agent, 'Test Agent')
        }
        return this._shim
    }

    getAgentApi() {
        if (!this._agentApi) {
            this._agentApi = new API(this.agent)
        }
        return this._agentApi
    }
}

module.exports = { TestAgent }
