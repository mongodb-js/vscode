import * as assert from 'assert';
import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';

const { contributes } = require('../../../../package.json');

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const sandbox = sinon.createSandbox();

  let createTerminalStub: any;
  let fakeSendTerminalText: any;

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');

    createTerminalStub = sandbox.stub();
    fakeSendTerminalText = sandbox.stub();

    createTerminalStub.returns({
      sendText: fakeSendTerminalText,
      show: () => {}
    });
    sandbox.replace(vscode.window, 'createTerminal', createTerminalStub);
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  test('there should be 3 views registered in the package.json', () => {
    assert(contributes.views.mongodb.length === 3);
    assert(contributes.views.mongodb.id === 'mongoDBConnectionExplorer');
    assert(contributes.views.mongodb.id === 'mongoDBPlaygroundsExplorer');
    assert(contributes.views.mongodb.id === 'mongoDBHelpExplorer');
  });

  test('commands are registered in vscode', async () => {
    const registeredCommands = await vscode.commands.getCommands();

    const expectedCommands = [
      // General / connection commands.
      'mdb.connect',
      'mdb.connectWithURI',
      'mdb.disconnect',
      'mdb.removeConnection',
      'mdb.openMongoDBShell',
      'mdb.createPlayground',
      'mdb.createNewPlaygroundFromViewAction',
      'mdb.createNewPlaygroundFromPlaygroundExplorer',

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
      try {
        assert.notEqual(
          registeredCommands.indexOf(expectedCommands[i]),
          -1,
          `command ${expectedCommands[i]} not registered and was expected`
        );
      } catch (e) {
        assert(false);
        return;
      }
    }
  });
});
