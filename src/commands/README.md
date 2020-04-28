# Extension Commands

This README contains a list of all of the commands the extension handles.

These commands are defined in `package.json`, registered from `extension.ts` to
handlers defined in `mdb.ts`.
Think RPC handlers.

## Connection commands

- `mdb.connect`
- `mdb.connectWithURI`
- `mdb.disconnect`
- `mdb.removeConnection`
- `mdb.reload`
- `mdb.refresh`

- `mdb.openMongoDBShell`

## General database commands

- `mdb.createDatabase`
- `mdb.createCollection`

- `mdb.createDocument`
- `mdb.removeDocument`
- `mdb.updateDocument`

- `mdb.viewCollectionDocuments`

## Query commands (json input fields)

- `mdb.aggregate`
- `mdb.explainAggregate`
- `mdb.find`
- `mdb.findOne`
- `mdb.findBy` _-> pick(value) -> pick(key) -> show_
- `mdb.explain` _Uses the active cursor (only possible after a query)_
- `mdb.getMore` _Uses the active cursor (only possible after a query)_

## Playground commands

- `mdb.playground`
- `mdb.createPlayground`
- `mdb.removePlayground`
- `mdb.runPlaygroundBlock`
- `mdb.runAllPlaygroundBlocks`
- `mdb.createNewPlaygroundFromViewAction`

## Index commands

- `mdb.createIndex`
- `mdb.getIndex`
- `mdb.removeIndex`

## Import/Export commands

- `mdb.importDocument`

- `mdb.import`
- `mdb.cancelImport`
- `mdb.export`
- `mdb.cancelExport`

## CodeLens commands

- `mdb.codeLens.showMoreDocumentsClicked`
