import assert from 'assert';
import * as vscode from 'vscode';

const { contributes } = require('../../../package.json');

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('there should be 3 views registered in the package.json', () => {
    assert(contributes.views.mongoDB.length === 3);
    assert(contributes.views.mongoDB[0].id === 'mongoDBConnectionExplorer');
    assert(contributes.views.mongoDB[1].id === 'mongoDBPlaygroundsExplorer');
    assert(contributes.views.mongoDB[2].id === 'mongoDBHelpExplorer');
  });

  test('commands are registered in vscode', async () => {
    const registeredCommands = await vscode.commands.getCommands();

    const expectedCommands = [
      // General / connection commands.
      'mdb.connect',
      'mdb.connectWithURI',
      'mdb.openOverviewPage',
      'mdb.disconnect',
      'mdb.removeConnection',
      'mdb.openMongoDBShell',
      'mdb.createPlayground',
      'mdb.createNewPlaygroundFromOverviewPage',
      'mdb.createNewPlaygroundFromPlaygroundExplorer',
      'mdb.createNewPlaygroundFromViewAction',

      // Tree view commands.
      'mdb.addConnection',
      'mdb.addConnectionWithURI',
      'mdb.copyConnectionString',
      'mdb.treeItemRemoveConnection',
      'mdb.treeViewOpenMongoDBShell',
      'mdb.addDatabase',
      'mdb.refreshConnection',
      'mdb.copyDatabaseName',
      'mdb.refreshDatabase',
      'mdb.addCollection',
      'mdb.viewCollectionDocuments',
      'mdb.refreshDocumentList',
      'mdb.searchForDocuments',
      'mdb.copyCollectionName',
      'mdb.refreshCollection',
      'mdb.refreshSchema',
      'mdb.copySchemaFieldName',
      'mdb.refreshIndexes',
      'mdb.createIndexFromTreeView',

      // Editor commands.
      'mdb.codeLens.showMoreDocumentsClicked'
    ];

    for (let i = 0; i < expectedCommands.length; i++) {
      assert.notEqual(
        registeredCommands.indexOf(expectedCommands[i]),
        -1,
        `command ${expectedCommands[i]} not registered and was expected`
      );
    }
  });
});
