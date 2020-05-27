import * as assert from 'assert';
import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';
import Connection = require('mongodb-connection-model/lib/model');
import MDBExtensionController from '../../mdbExtensionController';
import { TestExtensionContext } from './stubs';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const mockExtensionContext = new TestExtensionContext();
  const mockMDBExtension = new MDBExtensionController(mockExtensionContext);
  const sandbox = sinon.createSandbox();

  let fakeShowErrorMessage: any;
  let fakeGetActiveConnectionModel: any;
  let fakeIsCurrentlyConnected: any;
  let createTerminalSpy: any;

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');

    fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
    fakeGetActiveConnectionModel = sandbox.stub(
      mockMDBExtension._connectionController,
      'getActiveConnectionModel'
    );
    fakeIsCurrentlyConnected = sandbox.stub(
      mockMDBExtension._connectionController,
      'isCurrentlyConnected'
    );

    createTerminalSpy = sinon.spy(vscode.window, 'createTerminal');
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
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

      // Tree view commands.
      'mdb.addConnection',
      'mdb.addConnectionWithURI',
      'mdb.copyConnectionString',
      'mdb.treeItemRemoveConnection',
      'mdb.addDatabase',
      'mdb.refreshConnection',
      'mdb.copyDatabaseName',
      'mdb.refreshDatabase',
      'mdb.addCollection',
      'mdb.viewCollectionDocuments',
      'mdb.copyCollectionName',
      'mdb.refreshCollection',
      'mdb.refreshSchema',

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

  test('openMongoDBShell should display an error message when not connected', async () => {
    const errorMessage =
      'You need to be connected before launching the MongoDB Shell.';

    fakeShowErrorMessage.resolves(errorMessage);

    try {
      await mockMDBExtension.openMongoDBShell();
    } catch (error) {
      sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
    }
  });

  test('openMongoDBShell should open a terminal with the active connection driver url', async () => {
    const driverUri =
      'mongodb://localhost:27018/?readPreference=primary&ssl=false';

    fakeGetActiveConnectionModel.returns(
      new Connection({
        hostname: 'localhost',
        port: 27018
      })
    );
    fakeIsCurrentlyConnected.returns(true);

    try {
      await mockMDBExtension.openMongoDBShell();

      assert(createTerminalSpy.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalSpy.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === driverUri,
        `Expected open terminal to set env var 'MDB_CONNECTION_STRING' to ${driverUri} found ${terminalOptions.env?.MDB_CONNECTION_STRING}`
      );

      await mockMDBExtension._connectionController.disconnect();
      mockMDBExtension._connectionController.clearAllConnections();
    } catch (e) {
      assert(false);
      return;
    }
  });

  test('openMongoDBShell should open a terminal with ssh tunnel port injected', async () => {
    const driverUri =
      'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=false';

    fakeGetActiveConnectionModel.returns(
      new Connection({
        hostname: '127.0.0.1',
        sshTunnel: 'USER_PASSWORD',
        sshTunnelHostname: 'my.ssh-server.com',
        sshTunnelUsername: 'my-user',
        sshTunnelPassword: 'password'
      })
    );
    fakeIsCurrentlyConnected.returns(true);

    try {
      await mockMDBExtension.openMongoDBShell();

      assert(createTerminalSpy.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalSpy.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING !== driverUri,
        `Expected open terminal to set env var 'MDB_CONNECTION_STRING' to driver url with ssh tunnel port injected found ${terminalOptions.env?.MDB_CONNECTION_STRING}`
      );

      await mockMDBExtension._connectionController.disconnect();
      mockMDBExtension._connectionController.clearAllConnections();
    } catch (e) {
      assert(false);
      return;
    }
  });
});
