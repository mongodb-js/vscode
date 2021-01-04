enum EXTENSION_COMMANDS {
  MDB_CONNECT = 'mdb.connect',
  MDB_CONNECT_WITH_URI = 'mdb.connectWithURI',
  MDB_OPEN_OVERVIEW_PAGE = 'mdb.openOverviewPage',
  MDB_DISCONNECT = 'mdb.disconnect',
  MDB_REMOVE_CONNECTION = 'mdb.removeConnection',

  MDB_OPEN_MDB_SHELL = 'mdb.openMongoDBShell',
  MDB_OPEN_MDB_SHELL_FROM_TREE_VIEW = 'mdb.treeViewOpenMongoDBShell',

  MDB_CREATE_PLAYGROUND = 'mdb.createPlayground',
  MDB_CREATE_PLAYGROUND_FROM_OVERVIEW_PAGE = 'mdb.createNewPlaygroundFromOverviewPage',
  MDB_RUN_SELECTED_PLAYGROUND_BLOCKS = 'mdb.runSelectedPlaygroundBlocks',
  MDB_RUN_ALL_PLAYGROUND_BLOCKS = 'mdb.runAllPlaygroundBlocks',
  MDB_RUN_ALL_OR_SELECTED_PLAYGROUND_BLOCKS = 'mdb.runPlayground',
  MDB_REFRESH_PLAYGROUND_RESULT = 'mdb.refreshPlaygroundResult',
  MDB_REFRESH_PLAYGROUND_RESULT_CONTENT = 'mdb.refreshPlaygroundResultContent',

  MDB_SAVE_DOCUMENT_TO_MONGODB = 'mdb.saveDocumentToMongoDB',

  MDB_CHANGE_ACTIVE_CONNECTION = 'mdb.changeActiveConnection',
  MDB_REFRESH_PLAYGROUNDS = 'mdb.refreshPlaygrounds',
  MDB_START_LANGUAGE_STREAM_LOGS = 'mdb.startStreamLanguageServerLogs',

  MDB_CODELENS_SHOW_MORE_DOCUMENTS = 'mdb.codeLens.showMoreDocumentsClicked',

  // Commands from the tree view.
  MDB_ADD_CONNECTION = 'mdb.addConnection',
  MDB_ADD_CONNECTION_WITH_URI = 'mdb.addConnectionWithURI',
  MDB_REFRESH_PLAYGROUNDS_FROM_TREE_VIEW = 'mdb.refreshPlaygroundsFromTreeView',
  MDB_OPEN_PLAYGROUND_FROM_TREE_VIEW = 'mdb.openPlaygroundFromTreeItem',
  MDB_CONNECT_TO_CONNECTION_TREE_VIEW = 'mdb.connectToConnectionTreeItem',
  MDB_CREATE_PLAYGROUND_FROM_VIEW_ACTION = 'mdb.createNewPlaygroundFromViewAction',
  MDB_CREATE_PLAYGROUND_FROM_PLAYGROUND_EXPLORER = 'mdb.createNewPlaygroundFromPlaygroundExplorer',
  MDB_DISCONNECT_FROM_CONNECTION_TREE_VIEW = 'mdb.disconnectFromConnectionTreeItem',
  MDB_REFRESH_CONNECTION = 'mdb.refreshConnection',
  MDB_COPY_CONNECTION_STRING = 'mdb.copyConnectionString',
  MDB_REMOVE_CONNECTION_TREE_VIEW = 'mdb.treeItemRemoveConnection',
  MDB_RENAME_CONNECTION = 'mdb.renameConnection',
  MDB_ADD_DATABASE = 'mdb.addDatabase',
  MDB_SEARCH_FOR_DOCUMENTS = 'mdb.searchForDocuments',
  MDB_COPY_DATABASE_NAME = 'mdb.copyDatabaseName',
  MDB_DROP_DATABASE = 'mdb.dropDatabase',
  MDB_REFRESH_DATABASE = 'mdb.refreshDatabase',
  MDB_ADD_COLLECTION = 'mdb.addCollection',
  MDB_COPY_COLLECTION_NAME = 'mdb.copyCollectionName',
  MDB_DROP_COLLECTION = 'mdb.dropCollection',
  MDB_VIEW_DOCUMENT = 'mdb.viewDocument',
  MDB_VIEW_COLLECTION_DOCUMENTS = 'mdb.viewCollectionDocuments',
  MDB_REFRESH_COLLECTION = 'mdb.refreshCollection',
  MDB_REFRESH_DOCUMENT_LIST = 'mdb.refreshDocumentList',
  MDB_REFRESH_SCHEMA = 'mdb.refreshSchema',
  MDB_COPY_SCHEMA_FIELD_NAME = 'mdb.copySchemaFieldName',
  MDB_REFRESH_INDEXES = 'mdb.refreshIndexes',
  MDB_CREATE_INDEX_TREE_VIEW = 'mdb.createIndexFromTreeView'
}

export default EXTENSION_COMMANDS;
