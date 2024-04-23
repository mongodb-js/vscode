# Change Log

## [v1.6.0](https://github.com/mongodb-js/vscode/releases/tag/v1.6.0) - 2024-04-23

## What's Changed
* chore: update CHANGELOG.md by @github-actions in https://github.com/mongodb-js/vscode/pull/675
* feat: add export to Rust and PHP VSCODE-411 by @paula-stacho in https://github.com/mongodb-js/vscode/pull/676
* chore(ci): sign using package by @mabaasit in https://github.com/mongodb-js/vscode/pull/678
* fix: include export mode when retrieving import statements VSCODE-440 by @paula-stacho in https://github.com/mongodb-js/vscode/pull/677
* chore(dependabot): update dependabot to use the increase strategy by @mcasimir in https://github.com/mongodb-js/vscode/pull/682
* chore(deps-dev): bump @mongodb-js/oidc-mock-provider from 0.6.9 to 0.6.10 by @dependabot in https://github.com/mongodb-js/vscode/pull/670
* chore(deps-dev): bump @mongodb-js/mongodb-downloader from 0.2.9 to 0.2.10 by @dependabot in https://github.com/mongodb-js/vscode/pull/669
* fix: remove userId COMPASS-7608 by @paula-stacho in https://github.com/mongodb-js/vscode/pull/690
* chore(deps): bump socks to 2.7.3 VSCODE-520 by @addaleax in https://github.com/mongodb-js/vscode/pull/693
* chore: add Atlas Stream Processing to readme with screenshot by @Anemy in https://github.com/mongodb-js/vscode/pull/694
* feat: add changeActiveConnection command to palette by @benjlevesque in https://github.com/mongodb-js/vscode/pull/700
* feat: show simpler uuid format VSCODE-470 by @paula-stacho in https://github.com/mongodb-js/vscode/pull/701
* chore(deps): update jose by @himanshusinghs in https://github.com/mongodb-js/vscode/pull/707
* chore(ci): update create-pull-request, add id by @lerouxb in https://github.com/mongodb-js/vscode/pull/710
* chore(deps-dev): bump mongodb-runner from 5.4.5 to 5.5.2 by @dependabot in https://github.com/mongodb-js/vscode/pull/664
* chore(deps): bump @mongodb-js/saslprep from 1.1.0 to 1.1.4 by @dependabot in https://github.com/mongodb-js/vscode/pull/665
* chore(deps): bump express to 4.19.2 VSCODE-527 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/712
* feat(playground): add support local require VSCODE-468 by @mabaasit in https://github.com/mongodb-js/vscode/pull/718

## New Contributors
* @paula-stacho made their first contribution in https://github.com/mongodb-js/vscode/pull/676
* @benjlevesque made their first contribution in https://github.com/mongodb-js/vscode/pull/700

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v1.5.0...v1.6.0


## [v1.5.0](https://github.com/mongodb-js/vscode/releases/tag/v1.5.0) - 2024-01-24

## What's Changed
* VSCODE-505: stream support in UI by @shaketbaby in https://github.com/mongodb-js/vscode/pull/643
* feat(webview): use new connection form, remove old form VSCODE-491 by @Anemy in https://github.com/mongodb-js/vscode/pull/636
* fix: add explicit ordering for stream processor context menu actions by @pulkitkalra-mdb in https://github.com/mongodb-js/vscode/pull/654
* chore: close connection string input when opening form VSCODE-507 by @Anemy in https://github.com/mongodb-js/vscode/pull/656
* fix: ensure extension output populates ObjectIds in stream by @pulkitkalra-mdb in https://github.com/mongodb-js/vscode/pull/657
* feat(connect-form): add OIDC device auth flow with preference VSCODE-503 by @Anemy in https://github.com/mongodb-js/vscode/pull/658
* feat(connections): add edit connection context menu action VSCODE-406 by @Anemy in https://github.com/mongodb-js/vscode/pull/655
* chore(deps): update mongodb and devtools dependencies by @Anemy in https://github.com/mongodb-js/vscode/pull/662
* chore: cancel connection attempt when removing connection, update assert to expect in webview and connection controller tests by @Anemy in https://github.com/mongodb-js/vscode/pull/667

## New Contributors
* @pulkitkalra-mdb made their first contribution in https://github.com/mongodb-js/vscode/pull/654

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v1.4.0...v1.5.0


## [v1.4.0](https://github.com/mongodb-js/vscode/releases/tag/v1.4.0) - 2024-01-09

## What's Changed
* feat: send logs to a LogOutputChannel VSCODE-429 by @baileympearson in https://github.com/mongodb-js/vscode/pull/616
* feat: enable language server logs to be opened as a log file VSCODE-429 by @baileympearson in https://github.com/mongodb-js/vscode/pull/618
* fix(explorer): auto-open connection when done connecting, fix auto open on delete VSCODE-325 VSCODE-398 by @Anemy in https://github.com/mongodb-js/vscode/pull/619
* feat: adds a new overview screen based on LeafyGreen components VSCODE-485 by @himanshusinghs in https://github.com/mongodb-js/vscode/pull/617
* chore(playground): codelens for active connection will inform about default connected database VSCODE-316 by @himanshusinghs in https://github.com/mongodb-js/vscode/pull/621
* feat(webview): use Compass' connection form in the new overview page VSCODE-488 by @Anemy in https://github.com/mongodb-js/vscode/pull/622
* chore(connections): remove keytar, keytar migration, and connection model migration VSCODE-499 by @Anemy in https://github.com/mongodb-js/vscode/pull/625
* chore: add connection storage, simplify connection controller and storage controller interfaces by @Anemy in https://github.com/mongodb-js/vscode/pull/627
* chore: update segment client VSCODE-498, VSCODE-501 by @mcasimir in https://github.com/mongodb-js/vscode/pull/626
* chore(ci): sign vsix file VSCODE-493 by @mcasimir in https://github.com/mongodb-js/vscode/pull/632
* feat(webview): update feature flag to always show new connection form VSCODE-490 by @Anemy in https://github.com/mongodb-js/vscode/pull/637
* feat: add OIDC auth support, enable in new form VSCODE-354 by @Anemy in https://github.com/mongodb-js/vscode/pull/630
* VSCODE-504: streams support in playgrounds by @shaketbaby in https://github.com/mongodb-js/vscode/pull/633

## New Contributors
* @baileympearson made their first contribution in https://github.com/mongodb-js/vscode/pull/616
* @shaketbaby made their first contribution in https://github.com/mongodb-js/vscode/pull/633

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v1.3.1...v1.4.0


## [v1.3.1](https://github.com/mongodb-js/vscode/releases/tag/v1.3.1) - 2023-10-09

## What's Changed
* fix(playgrounds): stringify non-string types for playground output VSCODE-466 by @Anemy in https://github.com/mongodb-js/vscode/pull/590
* feat: update mongosh to 2.0.0 and driver to 6.0.0 VSCODE-453 by @addaleax in https://github.com/mongodb-js/vscode/pull/592
* feat(autocomplete): introduce $vectorSearch aggregation stage to 7.1 and 7.0.x COMPASS-7064 by @mcasimir in https://github.com/mongodb-js/vscode/pull/593
* fix: resolve SRV hostname before passing it to mongodb-cloud-info VSCODE-442 by @addaleax in https://github.com/mongodb-js/vscode/pull/594

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v1.2.1...v1.3.1


## [v1.2.1](https://github.com/mongodb-js/vscode/releases/tag/v1.2.1) - 2023-08-23

## What's Changed
* chore: use consistent type imports VSCODE-410 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/579
* chore: start changelog PR from head, add manual trigger and build nightly by @mcasimir in https://github.com/mongodb-js/vscode/pull/580
* chore: update CHANGELOG.md by @github-actions in https://github.com/mongodb-js/vscode/pull/581
* fix: disable "Saved Connections Loaded" event by @alenakhineika in https://github.com/mongodb-js/vscode/pull/585
* fix: check secretStorageLocation instead of storageLocation by @alenakhineika in https://github.com/mongodb-js/vscode/pull/583

## New Contributors
* @github-actions made their first contribution in https://github.com/mongodb-js/vscode/pull/581

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v1.2.0...v1.2.1


## [v1.2.0](https://github.com/mongodb-js/vscode/releases/tag/v1.2.0) - 2023-08-15

## What's Changed
* feat: added Export to Go support VSCODE-411 by @GaurabAryal in https://github.com/mongodb-js/vscode/pull/567
* chore: only load keytar during the migration process VSCODE-450 by @kmruiz in https://github.com/mongodb-js/vscode/pull/572
* fix: adopt dns result order changes VSCODE-458 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/575

## New Contributors
* @GaurabAryal made their first contribution in https://github.com/mongodb-js/vscode/pull/567
* @kmruiz made their first contribution in https://github.com/mongodb-js/vscode/pull/572

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v1.1.0...v1.2.0


## [v1.1.0](https://github.com/mongodb-js/vscode/releases/tag/v1.1.0) - 2023-07-14

# Important Information
Starting with this release (v1.1.0), our Extension will use VS Code's SecretStorage api to store secrets for saved connections, instead of [Keytar](https://github.com/atom/node-keytar) which is now officially archived and not maintained anymore.

To dig deeper please feel free to follow the links mentioned below:
- [VS Code's announcement about removal of Keytar shim from VS Code](https://github.com/microsoft/vscode-discussions/discussions/662)
- [Issue created to remove the direct dependency on Keytar from our extension](https://github.com/mongodb-js/vscode/issues/546)

## What does this mean for our extension users?
- Nothing much, just update to the latest version of our extension. The extension itself will take care of restoring secrets from Keytar to SecretStorage.

---

### Change log
* chore(ci): truncate origins for vulnerability reports in jira by @mcasimir in https://github.com/mongodb-js/vscode/pull/547
* refactor: simplify constructor argument assignment VSCODE-441 by @Anemy in https://github.com/mongodb-js/vscode/pull/551
* chore: bump minor dependencies by @alenakhineika in https://github.com/mongodb-js/vscode/pull/553
* chore: added migration step to migrate keytar secrets to vscode SecretStorage - VSCODE-435 by @himanshusinghs in https://github.com/mongodb-js/vscode/pull/552
* feat(tree-explorer): sort dbs in the tree by name by @Anemy in https://github.com/mongodb-js/vscode/pull/488
* build(deps): bump json5 from 1.0.1 to 1.0.2 by @dependabot in https://github.com/mongodb-js/vscode/pull/463
* chore: update semver and a few other dependencies, removes unused code - VSCODE-436, VSCODE-437 by @Anemy in https://github.com/mongodb-js/vscode/pull/556
* chore: fix for ubuntu build failures by @himanshusinghs in https://github.com/mongodb-js/vscode/pull/561


**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v1.0.2...v1.1.0


## [v1.0.2](https://github.com/mongodb-js/vscode/releases/tag/v1.0.2) - 2023-06-21

## What's Changed
* feat: add autocomplete support for `$percentile`, `$median`, and `$$USER_ROLES` COMPASS-6780, COMPASS-6781 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/523
* chore: add new `utm` attributes to all mongodb links VSCODE-356 by @gribnoysup in https://github.com/mongodb-js/vscode/pull/526
* chore: bump mongosh and dataservice VSCODE-421 by @Anemy in https://github.com/mongodb-js/vscode/pull/528
* build(deps): bump `fast-xml-parser` and `@aws-sdk/credential-providers` by @dependabot in https://github.com/mongodb-js/vscode/pull/529
* chore(deps): bump `mongodb-cloud-info` to 2.0 for ipv6 support by @lerouxb in https://github.com/mongodb-js/vscode/pull/530
* Add `codeql` by @mcasimir in https://github.com/mongodb-js/vscode/pull/533
* docs: add testing matrix link and information to `CONTRIBUTING/Releasing` docs by @Anemy in https://github.com/mongodb-js/vscode/pull/531
* chore: add vulnerability scan VSCODE-424 by @mcasimir in https://github.com/mongodb-js/vscode/pull/532
* chore(ci): fix `create-jira-tickets` task by @mcasimir in https://github.com/mongodb-js/vscode/pull/534
* chore: update `mongodb-cloud-info` to v2.0.1 by @lerouxb in https://github.com/mongodb-js/vscode/pull/537
* chore(ci): fix failing jobs due to outdated actions by @mcasimir in https://github.com/mongodb-js/vscode/pull/535
* build: bump mongosh to 1.10.0 VSCODE-415 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/542
* test: run nightly tests against the latest VSCode VSCODE-340 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/543
* fix: disable playground loaded event VSCODE-432 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/545

## New Contributors
* @lerouxb made their first contribution in https://github.com/mongodb-js/vscode/pull/530

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v1.0.1...v1.0.2


## [v1.0.1](https://github.com/mongodb-js/vscode/releases/tag/v1.0.1) - 2023-05-17

## What's Changed
* feat: add playground created telemetry event VSCODE-379 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/508
* fix: collection with dots in the name disappears from the suggestions list VSCODE-407 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/514
* feat: clear completions cache on Refresh action on the sidebar VSCODE-408 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/517
* refactor: remove columnstore indexes COMPASS-6783 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/522
* docs: README updates VSCODE-395 by @mmarcon in https://github.com/mongodb-js/vscode/pull/516
* fix(docs): remove br html tag in markdown, remove extra spacing by @Anemy in https://github.com/mongodb-js/vscode/pull/524


**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v0.11.1...v1.0.1


## [v0.11.1](https://github.com/mongodb-js/vscode/releases/tag/v0.11.1) - 2023-03-31

## What's Changed
* feat(playground): adds new Time-Series options for collection creation in playgrounds VSCODE-362 by @himanshusinghs in https://github.com/mongodb-js/vscode/pull/478
* feat(playground): makes the creation of Column Store indexes more visible in index creation template VSCODE-364 by @himanshusinghs in https://github.com/mongodb-js/vscode/pull/479
* feat(tree-explorer): add insert document context menu action VSCODE-367 by @Anemy in https://github.com/mongodb-js/vscode/pull/469
* feat(playgrounds): update playground template VSCODE-337 by @Anemy in https://github.com/mongodb-js/vscode/pull/470
* fix: make install-local script work VSCODE-310 by @Anemy in https://github.com/mongodb-js/vscode/pull/471
* feat: playgrounds in JS VSCODE-372 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/482
* feat: show MongoDB completion items before other JS completion VSCODE-382, VSCODE-385 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/490
* feat: suggest use and db commands VSCODE-380 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/491
* feat: add diagnostics feature to the language server VSCODE-375 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/493
* feat: extend playground completions VSCODE-376, VSCODE-381, VSCODE-389, VSCODE-390 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/497
* feat: provide shell methods completions after getCollection VSCODE-390 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/498
* feat: system variables and fields completion VSCODE-377, VSCODE-393 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/500
* feat: add links to MQL documentation VSCODE-387 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/501
* docs: document the semantic highlighting issue VSCODE-374 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/503
* fix: save documents from the tree view and do not reopen them for playground runs VSCODE-399, VSCODE-400 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/504

## New Contributors
* @himanshusinghs made their first contribution in https://github.com/mongodb-js/vscode/pull/467

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v0.10.0...v0.11.1


## [v0.10.0](https://github.com/mongodb-js/vscode/releases/tag/v0.10.0) - 2023-01-12

## What's Changed
* feat(tree-explorer): Add open and copy document tree view context menu items VSCODE-348 by @Anemy in https://github.com/mongodb-js/vscode/pull/445
* feat(tree-explorer): add delete document context menu item VSCODE-349 by @Anemy in https://github.com/mongodb-js/vscode/pull/452
* fix(connections): improve disconnected action error messages by @Anemy in https://github.com/mongodb-js/vscode/pull/453
* feat(tree-explorer): add clone document context menu item to document item in tree explorer VSCODE-350 by @Anemy in https://github.com/mongodb-js/vscode/pull/458
* fix(playgrounds): handle out of memory playground worker VSCODE-269 by @Anemy in https://github.com/mongodb-js/vscode/pull/459
* chore(deps): bump mongosh to 1.6.2, driver to 4.13.0 VSCODE-357 by @Anemy in https://github.com/mongodb-js/vscode/pull/465


**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v0.9.5...v0.10.0


## [v0.9.5](https://github.com/mongodb-js/vscode/releases/tag/v0.9.5) - 2022-10-18

## Added

* feat: add command to generate objectid by @SethFalco in https://github.com/mongodb-js/vscode/pull/416
* feat: update MongoDB driver to ^4.10.0 VSCODE-342 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/439
* feat(playground): Add `clusteredIndex` option to createCollection playground template VSCODE-330 by @Anemy in https://github.com/mongodb-js/vscode/pull/409

## Fixed

* fix: correct order of enum docs by @SethFalco in https://github.com/mongodb-js/vscode/pull/426
* fix: export to language actions appear for regular playground results VSCODE-334 by @alenakhineika in https://github.com/mongodb-js/vscode/pull/434

## New Contributors
* @SethFalco made their first contribution in https://github.com/mongodb-js/vscode/pull/418

**Full Changelog**: https://github.com/mongodb-js/vscode/compare/v0.9.3...v0.9.5


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


