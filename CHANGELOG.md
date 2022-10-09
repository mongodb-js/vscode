# Change Log

## [v0.9.4](https://github.com/mongodb-js/vscode/releases/tag/untagged-2eeed8fca26491c0109f) - null

Edit the release notes before publishing.


## [v0.9.3](https://github.com/mongodb-js/vscode/releases/tag/v0.9.3) - 2022-04-26

## Fixed

- fix(shell): Fixed launching shell with SSH connections (VSCODE-327, #402)


## [v0.9.2](https://github.com/mongodb-js/vscode/releases/tag/v0.9.2) - 2022-03-08

## Changed

- Bumped our MongoDB node driver and mongosh dependencies (#385)
- Updated our connection logic to share the connection logic from mongosh (#390)
- Exposed export to Ruby as a language in the export to language feature (VSCODE-323, #391) 


## [v0.8.0](https://github.com/mongodb-js/vscode/releases/tag/v0.8.0) - 2022-01-19

### Changed

- Use new data service and connection model (VSCODE-297, #377)
- Use the connection-secrets module to protect all secrets (VSCODE-313). Addresses CVE-2021-32039 - Users with appropriate file access may be able to access unencrypted user credentials saved by MongoDB Extension for VS Code in a binary file. These credentials may be used by malicious attackers to perform unauthorized actions. This vulnerability affects all MongoDB Extension for VS Code including and prior to version 0.7.0.


## [v0.7.0](https://github.com/mongodb-js/vscode/releases/tag/v0.7.0) - 2021-12-01

### Added
- Added export to language for selected query content and aggregation content in playgrounds (VSCODE-296, #366)


## [v0.6.14](https://github.com/mongodb-js/vscode/releases/tag/v0.6.14) - 2021-10-25

### Added

- Added syntax support for new 5.1 features (VSCODE-306, VSCODE-305, VSCODE-304, VSCODE-302, #357, #359)

### Changed

- Updated MongoDB branding (VSCODE-297, #358)

### Fixed

- Fixed opening files with special characters in their _ids (VSCODE-276, #342)


## [v0.6.12](https://github.com/mongodb-js/vscode/releases/tag/v0.6.12) - 2021-10-04

### Changed

- Replaced code lenses with code actions for partially running playgrounds (VSCODE-247, #318)
- Updated the MongoDB driver to 4.1.2 and mongosh to 1.0.4 (VSCODE-270, #337)
- Updated the create collection time-series template to include granularity (VSCODE-292, #344)

### Fixed

- Fixed TLS/SSL files not resolving correctly when connecting with WSL(Windows Subsystem for Linux) (VSCODE-284, #343)
- Fixed playgrounds not loading SSL/TLS files correctly with new MongoDB node driver (VSCODE-292, #347)


## [v0.6.10](https://github.com/mongodb-js/vscode/releases/tag/v0.6.10) - 2021-07-27

### Fixed

- Removed extra newline character at the end of the link in the generated changelog (VSCODE-282, #332)
- Fixed image location referencing an incorrect branch in the generated VSCode marketplace README (VSCODE-281, #333)


## [v0.6.9](https://github.com/mongodb-js/vscode/releases/tag/v0.6.9) - 2021-07-27

### Fixed

- Fixed image locations in the published VSCode marketplace README resolving to an incorrect branch (VSCODE-281, #331)


## [v0.6.8](https://github.com/mongodb-js/vscode/releases/tag/v0.6.8) - 2021-07-27

### Added

- Added support for showing databases a user has permissions to when they cannot `listDatabases` (VSCODE-157, #317)

### Changed

- Updated code lenses in playgrounds to now appear at the end of a selection for partially running (#324)
- Update our CI release pipeline - this is the first automated release ✨ 


## [v0.6.0](https://github.com/mongodb-js/vscode/releases/tag/v0.6.0) - 2021-07-13

### Added

- Added icons for time-series collections (VSCODE-263, #296)
- Updated our mongosh dependency to 1.0.0 and MongoDB node driver to a fork of the 4.0.0 driver (VSCODE-264, #308)
- Added support for load balanced connections (#311)

### Changed

- Made mongosh the default shell when launching the shell from a saved connection (#306)
- Updated how collections and databases are created to use playgrounds instead of vscode inputs (VSCODE-262, #294)
- Updated how playgrounds are run to preserve focus on the editor when the results are shown (VSCODE-214, #290, #222)
- Updated the Atlas terraform snippet (#297)
- Updated the collections list to sort system collections to the end of the list (#298)

### Fixed

- Fixed showing an error when large files are shown in vscode which have tokenization disabled (VSCODE-250, #290)
- Fixed showing recently dropped collections and databases in the explorer (VSCODE-244, #288)


## [v0.5.0](https://github.com/mongodb-js/vscode/releases/tag/v0.5.0) - 2021-03-10

### Added

- Add documentation details to playground auto completion items (#267)

### Fixed

- Fix launching mongodb shell with ssl in bash (VSCODE-227, #270)


## [v0.4.2](https://github.com/mongodb-js/vscode/releases/tag/v0.4.2) - 2021-02-17

### Added

- Add icon to refresh collection documents list (#264)

### Changed

- Updated the Atlas link to have https (#259)


## [v0.4.1](https://github.com/mongodb-js/vscode/releases/tag/v0.4.1) - 2021-02-10

### Changed

- Updated the Atlas link in the overview page (#250)

### Fixed

- Fixed an issue with playground connectivity not defaulting the `directConnection` option to true (VSCODE-234, #255)
- Fixed an issue around showing an error while editing a playground file without an active MongoDB connection (VSCODE-231, #251)


## [v0.4.0](https://github.com/mongodb-js/vscode/releases/tag/v0.4.0) - 2021-01-25

### Added

- Added the ability to edit documents opened from the explorer panel (VSCODE-219, #226, #239)
- Added the ability to open and edit documents from playground results (VSCODE-222, #232)
- Added icons for connect and playground panel actions (VSCODE-179, #240)
- Added the ability to specify multiple hosts and ports in the connection form (VSCODE-208, #224)
- Added a feature where we show the overview page when the extension is first installed (VSCODE-167, #225)

### Changed

- Changed how we generate default connection names for new connections to better represent multiple hosts and ports, and srv records (VSCODE-221, #227)
- Changed how we show connectivity errors with the connection form (VSCODE-196, #217)

### Fixed

- Fix opening documents with a binary `_id` from the explorer panel (VSCODE-118, #220)
- Fixed playground log output panel to not display when a playground is open and when a playground is run and there was no log output (#234)
- Fixed code lenses for partial playground executions sometimes being missing (VSCODE-226, #243)


## [v0.3.0](https://github.com/mongodb-js/vscode/releases/tag/v0.3.0) - 2020-11-24

### Added

- Added a resources panel to the overview page (VSCODE-168, #208)
- Added a button to change currently connected connection name in overview page (VSCODE-189, #191)

### Changed

- Moved playground output to the editor, logs remain in the output section (VSCODE-177, #198)
- Playground results are now displayed in EJSON or text (VSCODE-203, #206)
- Connect commands route to overview page instead of directly to connection form (VSCODE-170, #210)
- Connection form shows in modal in overview page (VSCODE-173, #190)
- Index creation template now uses `createIndex` instead of `ensureIndex` (#205)

### Fixed

- Fix x509 username being required in connection string building and parsing (VSCODE-202, #203)
- Fix viewing documents Binary UUID _ids (VSCODE-118, #213)
- Fix opening mongodb shell on windows with git bash (VSCODE-200, #201)
- Fix opening mongodb shell on windows with an ssl file with a space in it (#201)
- Fix password encoding of connection strings when copying connection string and opening in mongodb shell (VSCODE-198, #207)

### Removed

- Removed custom font in overview page (#192)
- Removed sql pipeline stage operator (#211)


## [v0.2.1](https://github.com/mongodb-js/vscode/releases/tag/0.2.1) - 2020-10-20

### Added

- Added the ability to use print() and console.log() in playgrounds [#184](https://github.com/mongodb-js/vscode/pull/184)
- Added an overview page (more to come on this in future versions) [#178](https://github.com/mongodb-js/vscode/pull/178)
- Added a tooltip to fields in a collection's schema to show types found in the sampling for that field [#179](https://github.com/mongodb-js/vscode/pull/179)


## [v0.2.0](https://github.com/mongodb-js/vscode/releases/tag/v0.2.0) - 2020-10-01

### Added
- Added a Playgrounds panel that displays `.mongodb` playground files in the current VSCode workspace
- Added a setting to configure which folders and files are excluded from the playgrounds panel file searching
- Added a help and resources panel to the explorer with links to documentation and feedback portals
- Added a button to the indexes folder in the tree view which creates a playground prefilled with an index creation script
### Changed
- Updated our mongosh dependency to 0.4.2 to bring more functionality to playgrounds
### Fixed
- Fixed indexes expanded state caching in the connection explorer panel tree view


## [v0.1.1](https://github.com/mongodb-js/vscode/releases/tag/v0.1.1) - 2020-08-10

### Added

- Added a search for documents playground shortcut in the tree explorer view
- Added a copy field name right click action in a collection's schema in the tree explorer view
- Added a document count for a collection in the tree view (with hover tooltip for the full count)
- Added the ability to change the current connection when in an open playground file by using the codelens on the first line of the playground

### Changed

- Allow connecting to a new connection while already connecting to another connection
- Allow removing a new connection while it is connecting


## [v0.1.0](https://github.com/mongodb-js/vscode/releases/tag/v0.1.0) - 2020-07-16

### Added

- Added the ability to run partial playgrounds
- Added indexes to the explorer tree view

### Fixed

- Fixed an issue with the launch shell command in powershell
- Fixed an issue with the tree explorer freezing when double clicking an open schema


## [v0.0.4](https://github.com/mongodb-js/vscode/releases/tag/v0.0.4) - 2020-06-17

### Added

- Added `Launch MongoDB Shell` right click action for the active connection in the tree view

### Fixed

- Fixed an issue with connecting to ssl with the launch shell command
- Fixed an issue with the launch shell command on windows
- Fixed playgrounds not being able to run in WSL environments
- Updated our connection model dependency to pull in a fix for connection strings with `readPreferenceTags`

### Changed

- Connections in the tree view are now alphabetically sorted


## [v0.0.3](https://github.com/mongodb-js/vscode/releases/tag/v0.0.3) - 2020-05-26

### Added

- Added `require` support in playgrounds

### Fixed

- Fixed an issue with file pathing on SSL and SSH connections on windows
- Fixed an issue with connecting to mongodb through the shell while using SSH
- Fixed a connectivity issue with playgrounds and SSH connections
- Fixed an issue with having a babel config in a workspace root


## [v0.0.2](https://github.com/mongodb-js/vscode/releases/tag/v0.0.2) - 2020-05-13

This is the marketplace preview release of MongoDB for VS Code.

* MongoDB data explorer
* MongoDB Playgrounds
* Quick access to the MongoDB Shell

Take a look at [README.md](https://github.com/mongodb-js/vscode/blob/master/README.md) for an overview of the features.

This release can be found on the VS Code marketplace: https://marketplace.visualstudio.com/items?itemName=mongodb.mongodb-vscode


