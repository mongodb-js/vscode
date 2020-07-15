# Change Log

All notable changes to the "mongodb" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2020-07-15

### Added

- Added indexes to the explorer tree view
- Added the ability to run partial playgrounds

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
