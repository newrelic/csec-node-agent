### v1.0.1 (2024-02-07)
#### Bug fixes
* Reporting of framework in security event json 
#### Miscellaneous chores
* Updated software license to New Relic Software License Version 1.0
* Ability to send critical messages on successful startup of agent
* Updated Copyright headers
* Updated license in readme

### v0.7.0 (2024-01-18)
#### Features
* Handling to exclude unsupported content types from rxss processing
* Handling to report errors/critical messages to Security Engine
#### Bug fixes
* Fix for file operation event's parameter must be absolute path of file
* Fix for ReferenceError of commonUtils module
#### Miscellaneous chores
* Updated log event jsonName to "critical-messages"
* Removed dependency @aws-sdk/client-lambda
* Bumped follow-redirects from v1.15.2 to v1.15.4  
* Upgraded axios to v1.6.5 

### v0.6.0 (2024-01-03)
#### Features
* Added ws headers NR-CSEC-ENTITY-GUID and NR-CSEC-ENTITY-NAME
* Updated jsonVersion to 1.1.1 in security events
* Support to send important logs/errors to security engine
#### Bug fixes
* Added missing protocol in http request object
* Fix for honouring probing interval from policy
#### Miscellaneous chores
* Added nestjs test cases
* Additional logging for instrumented modules and methods 
* Upgraded axios to v1.6.3
* Removed pinned version for axios and check-disk-space
* Update in lockfileVersion of package-lock.json
* Updated @babel/traverse, protobufjs, fast-xml-parser and @aws-sdk/credential-providers
* Updated Readme.md


### v0.5.0 (2023-11-17)
#### Features
* IAST support for NestJS framework
#### Bug Fixes
* Fixed misspelled constant in fs.open() hook
* Minor fix in applicationInfo for pod properties
#### Miscellaneous chores
* Upgraded ws to v8.14.2 and updated initialization of websocket for v8.x.
* Upgraded check-disk-space to v3.4.0
* Upgraded @aws-sdk/client-lambda to v3.436.0

### v0.4.0 (2023-10-27)
#### Features
* Added event stats for RASP, IAST and exit events in healthcheck. 
#### Miscellaneous chores
* Deps: Updated uuid to v9.0.1 and @aws-sdk/client-lambda to v3.405.0
* Upgraded axios to 1.6.0 to resolve CVE-2023-45857 
#### Continuous integration
* Removed Node.js 14.x from CI.
* Added should_skip flag to skip CI based on label.

### v0.3.0 (2023-09-25)
#### Features
* Last leg acknowledgement in IAST scanning.
#### Bug Fixes
* Fix for mysql query params in security events.
* Logging update for default log level and status file flags.
* Update in IAST batch size processing.
* Disable instrumentation when security enabled flag is set to false
#### Miscellaneous Chores
* Readme update

### v0.2.1 (2023-08-07)
#### Bug Fixes
* Pinned check-disk-space to v3.3.1 to support Node.js v14
#### Miscellaneous Chores
* deps: Updated semver to v7.5.4 and @aws-sdk/client-lambda to v3.363.0
#### Continuous Integration
* Add Node.js 20.x to CI

### v0.2.0 (2023-07-24)
#### Features
* IAST data pull implementation
* Logging update

#### Bug Fixes
* Param fixes for mysql and file hooks.

### v0.1.3
* Updated semver to v7.5.3 (Fix for CWE-1333)
* Updated request-ip, log4js, html-entities, uuid and fast-safe-stringify to latest version.
* Fix for system call event generation to avoid null parameters in event.
* Fix for id in nr-csec-tracing-data.
* WS logging update.

### v0.1.2
* bump @aws-sdk/client-lambda to v3.348.0
* Minor fix in ws reconnect.

### v0.1.1
* Fix in mysql instrumentation on getConnection to check if callback is wrapped
* NR-123832: Support for fire and forget vulnerability detection
* Fixes for snapshot file.
* Handling for high_security config.
### v0.1.0
* Handling to use OS specific path separator.
* Functionality to create directories in windows environment.
* IAST support for windows.
* Log file permission fix.
### v0.0.8
* Handling for IP resolving to IPV4 as Node.js v17 and above no longer re-sorts results of IP address lookups and returns them as-is.
* Third Party Notices update
* Update in publish workflow
### v0.0.7
* Updated copyright header in source files
* ReadMe update
* Minor logging update
### v0.0.6
* Updated default fuzz host to 0.0.0.0
* Handling to get custom certificate path from config instead of environment variable

### v0.0.5
* Updated README file
* Init logging update
* Code refactoring
* Minor bug fixes