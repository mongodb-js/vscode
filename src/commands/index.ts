export const ExtensionCommand = {
  mdbConnect: 'mdb.connect',
  mdbConnectWithUri: 'mdb.connectWithURI',
  mdbOpenOverviewPage: 'mdb.openOverviewPage',
  mdbDisconnect: 'mdb.disconnect',
  mdbRemoveConnection: 'mdb.removeConnection',

  openMongodbIssueReporter: 'mdb.openMongoDBIssueReporter',

  mdbOpenMdbShell: 'mdb.openMongoDBShell',
  mdbOpenMdbShellFromTreeView: 'mdb.treeViewOpenMongoDBShell',

  mdbCreatePlayground: 'mdb.createPlayground',
  mdbCreatePlaygroundFromOverviewPage:
    'mdb.createNewPlaygroundFromOverviewPage',
  mdbRunSelectedPlaygroundBlocks: 'mdb.runSelectedPlaygroundBlocks',
  mdbRunAllPlaygroundBlocks: 'mdb.runAllPlaygroundBlocks',
  mdbRunAllOrSelectedPlaygroundBlocks: 'mdb.runPlayground',
  mdbExportCodeToPlayground: 'mdb.exportCodeToPlayground',

  mdbFixThisInvalidInteractiveSyntax: 'mdb.fixThisInvalidInteractiveSyntax',
  mdbFixAllInvalidInteractiveSyntax: 'mdb.fixAllInvalidInteractiveSyntax',

  mdbSelectTargetForExportToLanguage: 'mdb.selectTargetForExportToLanguage',
  mdbExportToLanguage: 'mdb.exportToLanguage',
  mdbChangeDriverSyntaxForExportToLanguage:
    'mdb.changeDriverSyntaxForExportToLanguage',

  mdbOpenMongodbDocumentFromCodeLens: 'mdb.openMongoDBDocumentFromCodeLens',
  mdbOpenMongodbDocumentFromTree: 'mdb.openMongoDBDocumentFromTree',
  mdbSaveMongodbDocument: 'mdb.saveMongoDBDocument',

  mdbChangeActiveConnection: 'mdb.changeActiveConnection',

  mdbCodelensShowMoreDocuments: 'mdb.codeLens.showMoreDocumentsClicked',

  // Commands from the tree view.
  mdbAddConnection: 'mdb.addConnection',
  mdbAddConnectionWithUri: 'mdb.addConnectionWithURI',
  mdbRefreshPlaygroundsFromTreeView: 'mdb.refreshPlaygroundsFromTreeView',
  mdbOpenPlaygroundFromTreeView: 'mdb.openPlaygroundFromTreeView',
  mdbConnectToConnectionTreeView: 'mdb.connectToConnectionTreeItem',
  mdbCreatePlaygroundFromTreeView: 'mdb.createNewPlaygroundFromTreeView',
  mdbCreatePlaygroundFromTreeItem: 'mdb.createNewPlaygroundFromTreeItem',
  mdbDisconnectFromConnectionTreeView: 'mdb.disconnectFromConnectionTreeItem',
  mdbEditConnection: 'mdb.editConnection',
  mdbRefreshConnection: 'mdb.refreshConnection',
  mdbCopyConnectionString: 'mdb.copyConnectionString',
  mdbEditPresetConnections: 'mdb.editPresetConnections',
  mdbRemoveConnectionTreeView: 'mdb.treeItemRemoveConnection',
  mdbRenameConnection: 'mdb.renameConnection',
  mdbAddDatabase: 'mdb.addDatabase',
  mdbSearchForDocuments: 'mdb.searchForDocuments',
  mdbCopyDatabaseName: 'mdb.copyDatabaseName',
  mdbDropDatabase: 'mdb.dropDatabase',
  mdbRefreshDatabase: 'mdb.refreshDatabase',
  mdbAddCollection: 'mdb.addCollection',
  mdbCopyCollectionName: 'mdb.copyCollectionName',
  mdbDropCollection: 'mdb.dropCollection',
  mdbViewCollectionDocuments: 'mdb.viewCollectionDocuments',
  mdbRefreshCollection: 'mdb.refreshCollection',
  mdbRefreshDocumentList: 'mdb.refreshDocumentList',
  mdbInsertDocumentFromTreeView: 'mdb.insertDocumentFromTreeView',
  mdbRefreshSchema: 'mdb.refreshSchema',
  mdbCopySchemaFieldName: 'mdb.copySchemaFieldName',
  mdbRefreshIndexes: 'mdb.refreshIndexes',
  mdbCreateIndexTreeView: 'mdb.createIndexFromTreeView',
  mdbInsertObjectidToEditor: 'mdb.insertObjectIdToEditor',
  mdbGenerateObjectidToClipboard: 'mdb.generateObjectIdToClipboard',
  mdbCopyDocumentContentsFromTreeView: 'mdb.copyDocumentContentsFromTreeView',
  mdbCloneDocumentFromTreeView: 'mdb.cloneDocumentFromTreeView',
  mdbDeleteDocumentFromTreeView: 'mdb.deleteDocumentFromTreeView',
  mdbAddStreamProcessor: 'mdb.addStreamProcessor',
  mdbStartStreamProcessor: 'mdb.startStreamProcessor',
  mdbStopStreamProcessor: 'mdb.stopStreamProcessor',
  mdbDropStreamProcessor: 'mdb.dropStreamProcessor',

  // Commands for the data browsing upgrade.
  mdbOpenCollectionPreviewFromTreeView:
    'mdb.openCollectionPreviewFromTreeView',

  // Chat participant.
  openParticipantCodeInPlayground: 'mdb.openParticipantCodeInPlayground',
  sendMessageToParticipant: 'mdb.sendMessageToParticipant',
  sendMessageToParticipantFromInput: 'mdb.sendMessageToParticipantFromInput',
  askCopilotFromTreeItem: 'mdb.askCopilotFromTreeItem',
  runParticipantCode: 'mdb.runParticipantCode',
  connectWithParticipant: 'mdb.connectWithParticipant',
  selectDatabaseWithParticipant: 'mdb.selectDatabaseWithParticipant',
  selectCollectionWithParticipant: 'mdb.selectCollectionWithParticipant',
  participantOpenRawSchemaOutput: 'mdb.participantViewRawSchemaOutput',
  showExportToLanguageResult: 'mdb.showExportToLanguageResult',

  // MCP Server commands.
  startMcpServer: 'mdb.startMCPServer',
  stopMcpServer: 'mdb.stopMCPServer',
  getMcpServerConfig: 'mdb.getMCPServerConfig',
} as const;

export type ExtensionCommand =
  (typeof ExtensionCommand)[keyof typeof ExtensionCommand];

export default ExtensionCommand;
