# Change Log

All notable changes to the "mongodb" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.4.1] - 2021-2-10

### Changed

- Updated the Atlas link in the overview page (#250)

### Fixed

- Fixed an issue with playground connectivity not defaulting the `directConnection` option to true (VSCODE-234, #255)
- Fixed an issue around showing an error while editing a playground file without an active MongoDB connection	(VSCODE-231, #251)

## [0.4.0] - 2021-1-25

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

## [0.3.0] - 2020-11-24

### Added

- Added a resources panel to the overview page (VSCODE-168, #208)
- Added a button to change currently connected connection name in overview page (VSCODE-189, #191)

### Changed

- Moved playground output to the editor, logs remain in the output section (VSCODE-177, #198)
- Playground results are now displayed in EJSON or text (VSCODE-203, #206)
- Connect commands route to overview page instead of directly to connection form (VSCODE-170, #210)
- Connection form shows in modal in overview page (VSCODE-173, #190)
- Index creation template now uses `createIndex` instead of `ensureIndex` (#205)

### Removed

- Removed custom font in overview page (#192)
- Removed sql pipeline stage operator (#211)

### Fixed

- Fix x509 username being required in connection string building and parsing (VSCODE-202, #203)
- Fix viewing documents Binary UUID _ids (VSCODE-118, #213)
- Fix opening mongodb shell on windows with git bash (VSCODE-200, #201)
- Fix opening mongodb shell on windows with an ssl file with a space in it (#201)
- Fix password encoding of connection strings when copying connection string and opening in mongodb shell (VSCODE-198, #207)

## [0.2.1] - 2020-10-20

### Added

- Added the ability to use print() and console.log() in playgrounds [#184](https://github.com/mongodb-js/vscode/pull/184)
- Added an overview page (more to come on this in future versions) [#178](https://github.com/mongodb-js/vscode/pull/178)
- Added a tooltip to fields in a collection's schema to show types found in the sampling for that field [#179](https://github.com/mongodb-js/vscode/pull/179)

## [0.2.0] - 2020-10-1

### Added

- Added a Playgrounds panel that displays `.mongodb` playground files in the current VSCode workspace
- Added a setting to configure which folders and files are excluded from the playgrounds panel file searching
- Added a help and resources panel to the explorer with links to documentation and feedback portals
- Added a button to the indexes folder in the tree view which creates a playground prefilled with an index creation script

### Changed

- Updated our mongosh dependency to 0.4.2 to bring more functionality to playgrounds

### Fixed

- Fixed indexes expanded state caching in the connection explorer panel tree view

## [0.1.1] - 2020-08-10

### Added

- Added a search for documents playground shortcut in the tree explorer view
- Added a copy field name right click action in a collection's schema in the tree explorer view
- Added a document count for a collection in the tree view (with hover tooltip for the full count)
- Added the ability to change the current connection when in an open playground file by using the codelens on the first line of the playground

### Changed

- Allow connecting to a new connection while already connecting to another connection
- Allow removing a new connection while it is connecting

## [0.1.0] - 2020-07-15

### Added

- Added the ability to run partial playgrounds
- Added indexes to the explorer tree view

### Fixed

- Fixed an issue with the launch shell command in powershell
- Fixed an issue with the tree explorer freezing when double clicking an open schema

## [0.0.4] - 2020-06-16

### Added

- Added `Launch MongoDB Shell` right click action for the active connection in the tree view

### Fixed

- Fixed an issue with connecting to ssl with the launch shell command
- Fixed an issue with the launch shell command on windows
- Fixed playgrounds not being able to run in WSL environments
- Updated our connection model dependency to pull in a fix for connection strings with `readPreferenceTags`

### Changed

- Connections in the tree view are now alphabetically sorted

## [0.0.3] - 2020-05-26

### Added

- Added `require` support in playgrounds

### Fixed

- Fixed an issue with file pathing on SSL and SSH connections on windows
- Fixed an issue with connecting to mongodb through the shell while using SSH
- Fixed a connectivity issue with playgrounds and SSH connections
- Fixed an issue with having a babel config in a workspace root

### Changed

- README copy tweaks.

## [0.0.2] - 2020-05-13

### Changed

- Marketplace preview release
- Marketplace README copy tweaks

## [0.0.1] - 2020-04-20

- Internal preview release

### Added

- MongoDB data explorer
- MongoDB Playgrounds
- Quick access to the MongoDB Shell
