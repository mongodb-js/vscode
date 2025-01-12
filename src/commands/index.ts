enum EXTENSION_COMMANDS {
  MDB_CONNECT = 'mdb.connect',
  MDB_CONNECT_WITH_URI = 'mdb.connectWithURI',
  MDB_OPEN_OVERVIEW_PAGE = 'mdb.openOverviewPage',
  MDB_DISCONNECT = 'mdb.disconnect',
  MDB_REMOVE_CONNECTION = 'mdb.removeConnection',

  OPEN_MONGODB_ISSUE_REPORTER = 'mdb.openMongoDBIssueReporter',

  MDB_OPEN_MDB_SHELL = 'mdb.openMongoDBShell',
  MDB_OPEN_MDB_SHELL_FROM_TREE_VIEW = 'mdb.treeViewOpenMongoDBShell',

  MDB_CREATE_PLAYGROUND = 'mdb.createPlayground',
  MDB_CREATE_PLAYGROUND_FROM_OVERVIEW_PAGE = 'mdb.createNewPlaygroundFromOverviewPage',
  MDB_RUN_SELECTED_PLAYGROUND_BLOCKS = 'mdb.runSelectedPlaygroundBlocks',
  MDB_RUN_ALL_PLAYGROUND_BLOCKS = 'mdb.runAllPlaygroundBlocks',
  MDB_RUN_ALL_OR_SELECTED_PLAYGROUND_BLOCKS = 'mdb.runPlayground',
  MDB_EXPORT_CODE_TO_PLAYGROUND = 'mdb.exportCodeToPlayground',

  MDB_FIX_THIS_INVALID_INTERACTIVE_SYNTAX = 'mdb.fixThisInvalidInteractiveSyntax',
  MDB_FIX_ALL_INVALID_INTERACTIVE_SYNTAX = 'mdb.fixAllInvalidInteractiveSyntax',

  MDB_SELECT_TARGET_FOR_EXPORT_TO_LANGUAGE = 'mdb.selectTargetForExportToLanguage',
  MDB_EXPORT_TO_LANGUAGE = 'mdb.exportToLanguage',
  MDB_CHANGE_DRIVER_SYNTAX_FOR_EXPORT_TO_LANGUAGE = 'mdb.changeDriverSyntaxForExportToLanguage',

  MDB_OPEN_MONGODB_DOCUMENT_FROM_CODE_LENS = 'mdb.openMongoDBDocumentFromCodeLens',
  MDB_OPEN_MONGODB_DOCUMENT_FROM_TREE = 'mdb.openMongoDBDocumentFromTree',
  MDB_SAVE_MONGODB_DOCUMENT = 'mdb.saveMongoDBDocument',

  MDB_CHANGE_ACTIVE_CONNECTION = 'mdb.changeActiveConnection',

  MDB_CODELENS_SHOW_MORE_DOCUMENTS = 'mdb.codeLens.showMoreDocumentsClicked',

  // Commands from the tree view.
  MDB_ADD_CONNECTION = 'mdb.addConnection',
  MDB_ADD_CONNECTION_WITH_URI = 'mdb.addConnectionWithURI',
  MDB_REFRESH_PLAYGROUNDS_FROM_TREE_VIEW = 'mdb.refreshPlaygroundsFromTreeView',
  MDB_OPEN_PLAYGROUND_FROM_TREE_VIEW = 'mdb.openPlaygroundFromTreeView',
  MDB_CONNECT_TO_CONNECTION_TREE_VIEW = 'mdb.connectToConnectionTreeItem',
  MDB_CREATE_PLAYGROUND_FROM_TREE_VIEW = 'mdb.createNewPlaygroundFromTreeView',
  MDB_CREATE_PLAYGROUND_FROM_TREE_ITEM = 'mdb.createNewPlaygroundFromTreeItem',
  MDB_DISCONNECT_FROM_CONNECTION_TREE_VIEW = 'mdb.disconnectFromConnectionTreeItem',
  MDB_EDIT_CONNECTION = 'mdb.editConnection',
  MDB_REFRESH_CONNECTION = 'mdb.refreshConnection',
  MDB_COPY_CONNECTION_STRING = 'mdb.copyConnectionString',
  MDB_OPEN_WORKSPACE_SETTINGS_FILE = 'mdb.openWorkspaceSettingsFile',
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
  MDB_VIEW_COLLECTION_DOCUMENTS = 'mdb.viewCollectionDocuments',
  MDB_REFRESH_COLLECTION = 'mdb.refreshCollection',
  MDB_REFRESH_DOCUMENT_LIST = 'mdb.refreshDocumentList',
  MDB_INSERT_DOCUMENT_FROM_TREE_VIEW = 'mdb.insertDocumentFromTreeView',
  MDB_REFRESH_SCHEMA = 'mdb.refreshSchema',
  MDB_COPY_SCHEMA_FIELD_NAME = 'mdb.copySchemaFieldName',
  MDB_REFRESH_INDEXES = 'mdb.refreshIndexes',
  MDB_CREATE_INDEX_TREE_VIEW = 'mdb.createIndexFromTreeView',
  MDB_INSERT_OBJECTID_TO_EDITOR = 'mdb.insertObjectIdToEditor',
  MDB_GENERATE_OBJECTID_TO_CLIPBOARD = 'mdb.generateObjectIdToClipboard',
  MDB_COPY_DOCUMENT_CONTENTS_FROM_TREE_VIEW = 'mdb.copyDocumentContentsFromTreeView',
  MDB_CLONE_DOCUMENT_FROM_TREE_VIEW = 'mdb.cloneDocumentFromTreeView',
  MDB_DELETE_DOCUMENT_FROM_TREE_VIEW = 'mdb.deleteDocumentFromTreeView',
  MDB_ADD_STREAM_PROCESSOR = 'mdb.addStreamProcessor',
  MDB_START_STREAM_PROCESSOR = 'mdb.startStreamProcessor',
  MDB_STOP_STREAM_PROCESSOR = 'mdb.stopStreamProcessor',
  MDB_DROP_STREAM_PROCESSOR = 'mdb.dropStreamProcessor',

  // Chat participant.
  OPEN_PARTICIPANT_CODE_IN_PLAYGROUND = 'mdb.openParticipantCodeInPlayground',
  SEND_MESSAGE_TO_PARTICIPANT = 'mdb.sendMessageToParticipant',
  SEND_MESSAGE_TO_PARTICIPANT_FROM_INPUT = 'mdb.sendMessageToParticipantFromInput',
  ASK_COPILOT_FROM_TREE_ITEM = 'mdb.askCopilotFromTreeItem',
  RUN_PARTICIPANT_CODE = 'mdb.runParticipantCode',
  CONNECT_WITH_PARTICIPANT = 'mdb.connectWithParticipant',
  SELECT_DATABASE_WITH_PARTICIPANT = 'mdb.selectDatabaseWithParticipant',
  SELECT_COLLECTION_WITH_PARTICIPANT = 'mdb.selectCollectionWithParticipant',
  PARTICIPANT_OPEN_RAW_SCHEMA_OUTPUT = 'mdb.participantViewRawSchemaOutput',
  SHOW_EXPORT_TO_LANGUAGE_RESULT = 'mdb.showExportToLanguageResult',
}

export type ExtensionCommand = EXTENSION_COMMANDS;

export default EXTENSION_COMMANDS;
