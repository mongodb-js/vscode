# Change Log

All notable changes to the "mongodb" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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
