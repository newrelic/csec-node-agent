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