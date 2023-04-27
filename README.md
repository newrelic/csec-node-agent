# New Relic Node.js security agent.

The New Relic security agent is in preview and is not generally available.This module enables instrumentation of Node.js application for interactive application security analysis (IAST) and exposes exploitable vulnerabilities. 
The IAST capability should only be used in pre-production environments as the application is tested for real exploitable vulnerabilities.


## Installation and Getting Started

Typically, most users use the version auto-installed by the [New Relic Node.js agent](https://github.com/newrelic/node-newrelic). You can see agent install instructions [here](https://github.com/newrelic/node-newrelic#installation-and-getting-started).

In some cases, installing a specific version is ideal. For example, new features or major changes might be released via a major version update to this module, prior to inclusion in the main New Relic Node.js Agent.

```
npm install @newrelic/security-agent
```

```js
// index.js
const  newrelic = require(‘newrelic’);
require(‘@newrelic/security-agent’).start(newrelic);
```

For more information, please see the agent [installation guide][3].

The @newrelic/security-agent must be explicitly enabled in order to perform IAST analysis of the application. In the newrelic.js, set the following parameters
```
 /**
  * Security Configurations
  */
   security: {
    /**
      * To completely disable security, set agent.enabled flag to false. If the flag is set to false, the security module is not loaded. This property is read only once at application start.
      */
    agent: {
      enabled: true
    },
    /**
     * enables/disables security agent functions and generation of events.
     */
    enabled: true,
    
/**
     *  Security agent provides two modes: IAST and RASP. Default is IAST.
     */
    mode: 'IAST',
    /**
     * Security agent validator URL. Must be prefixed with wss://.
     */
    validator_service_url: 'wss://csec.nr-data.net',
  }
```
## Getting Started

Our [API and developer documentation](http://newrelic.github.io/node-newrelic/) for writing instrumentation will be of help. We particularly recommend the tutorials and various "shim" API documentation.

### Supported  Modules

- http
- https
- fs
- child_process
- Mysql (2.16.x and above)
- Mysql2 (2.x and above)
- Pg (7.x and above)
- Mongodb (2.x, 3.x and 4.x)
- Express (4.x and above)
- @koa/router ((9.x and above)
- Koa-router (9.x and above)
- @hapi/hapi (19.x and above)
- Fastify (2.x, 3.x and 4.x)
- Restify (8.x, 9.x, 10.x and 11.x)
- Director (1.2.x)
- Ldapjs (2.x and above)
- Ldapts (2.x and above)
- Xpath (0.0.20 and above)
- Xpath.js (0.0.1 and above) 

For more information, please see the agent [compatibility and requirements][4].

## Testing

The module includes a suite of unit and functional tests which should be used to
verify that your changes don't break existing functionality.

All tests are stored in `tests/` and are written using
[Tap](https://www.npmjs.com/package/tap) with the extension `.tap.js`.

To run the full suite, run: `npm test`.


## Support

New Relic hosts and moderates an online forum where you can interact with New Relic employees as well as other customers to get help and share best practices.  You can find this project's topic/threads here:  Add the url for the support thread here: https://forum.newrelic.com/s/

## Contribute

Any feedback provided to New Relic about the New Relic csec-node-agent, including feedback provided as source code, comments, or other copyrightable or patentable material, is provided to New Relic under the terms of the Apache Software License, version 2. If you do not provide attribution information or a copy of the license with your feedback, you waive the performance of those requirements of the Apache License with respect to New Relic. The license grant regarding any feedback is irrevocable and persists past the termination of the preview license.
Keep in mind that when you submit a pull request or other feedback, you’ll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.
If you have any questions drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](https://github.com/newrelic/csec-node-agent/security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

If you would like to contribute to this project, review [these guidelines](https://github.com/newrelic/csec-node-agent/blob/main/CONTRIBUTING.md).

## License
The New Relic security agent is licensed under the New Relic Pre-Release Software Notice.
The @newrelic/security-agent also uses source code from third-party libraries. You can find full details on which libraries are used and the terms under which they are licensed in the third-party notices document.
