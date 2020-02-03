# Extension Commands

This README contains a list of all of the commands the extension handles.

These commands are defined in `package.json`, registered from `extension.ts` to
handlers defined in `mdb.ts`.
Think RPC handlers.

## Connection commands
- `mdb.connect`
- `mdb.connectWithURI`
- `mdb.addConnection`
- `mdb.addConnectionWithURI`
- `mdb.removeConnection`
- `mdb.reload`
- `mdb.refresh`

## General database commands
- `mdb.createDatabase`
- `mdb.dropDatabase`
- `mdb.createCollection`
- `mdb.dropCollection`

- `mdb.createDocument`
- `mdb.removeDocument`
- `mdb.updateDocument`

- `mdb.launchMongoShell`

## Query commands (json input fields)
- `mdb.aggregate`
- `mdb.explainAggregate`
- `mdb.find`
- `mdb.findOne`
- `mdb.findBy`  *-> pick(value) -> pick(key) -> show*
- `mdb.explain` *Uses the active cursor (only possible after a query)*
- `mdb.getMore` *Uses the active cursor (only possible after a query)*

## Playground commands
- `mdb.playground`
- `mdb.createPlayground`
- `mdb.removePlayground`
- `mdb.runPlaygroundBlock`
- `mdb.runAllPlaygroundBlocks`

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
