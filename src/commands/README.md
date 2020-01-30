# Extension Commands

This README contains a list of all of the commands the extension handles.

These commands are defined in `package.json`, registered from `extension.ts` to
handlers defined in this directory.
Think RPC handlers.

## Connection commands
- `onCommand:mdb.connect`
- `onCommand:mdb.connectWithURI`
- `onCommand:mdb.addConnection`
- `onCommand:mdb.addConnectionWithURI`
- `onCommand:mdb.removeConnection`
- `onCommand:mdb.reload`
- `onCommand:mdb.refresh`

## General database commands
- `onCommand:mdb.createDatabase`
- `onCommand:mdb.dropDatabase`
- `onCommand:mdb.createCollection`
- `onCommand:mdb.dropCollection`

- `onCommand:mdb.createDocument`
- `onCommand:mdb.removeDocument`
- `onCommand:mdb.updateDocument`

- `onCommand:mdb.launchMongoShell`

## Query commands (json input fields)
- `onCommand:mdb.aggregate`
- `onCommand:mdb.explainAggregate`
- `onCommand:mdb.find`
- `onCommand:mdb.findOne`
- `onCommand:mdb.findBy", // -> pick(value) -> pick(key) -> sho`
- `onCommand:mdb.explain` *Uses the active cursor (only possible after a query)*
- `onCommand:mdb.getMore` *Uses the active cursor (only possible after a query)*

## Playground commands
- `onCommand:mdb.playground`
- `onCommand:mdb.createPlayground`
- `onCommand:mdb.removePlayground`
- `onCommand:mdb.runPlaygroundBlock`
- `onCommand:mdb.runAllPlaygroundBlocks`

## Index commands
- `onCommand:mdb.createIndex`
- `onCommand:mdb.getIndex`
- `onCommand:mdb.removeIndex`

## Import/Export commands
- `onCommand:mdb.importDocument`

- `onCommand:mdb.import`
- `onCommand:mdb.cancelImport`
- `onCommand:mdb.export`
- `onCommand:mdb.cancelExport`
