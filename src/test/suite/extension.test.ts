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

    await mockMDBExtension.openMongoDBShell();

    assert(createTerminalSpy.called);

    const terminalOptions: vscode.TerminalOptions =
      createTerminalSpy.firstCall.args[0];

    let shellArgs = terminalOptions.shellArgs;
    assert(
      shellArgs !== undefined,
      'Expected shell arguments to exist'
    );
    shellArgs = shellArgs || [];

    assert(
      shellArgs[0] === driverUri,
      `Expected open terminal to set shell arg as driver url "${driverUri}" found "${shellArgs[0]}"`
    );

    await mockMDBExtension._connectionController.disconnect();
    mockMDBExtension._connectionController.clearAllConnections();
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

    await mockMDBExtension.openMongoDBShell();

    assert(createTerminalSpy.called);

    const terminalOptions: vscode.TerminalOptions =
      createTerminalSpy.firstCall.args[0];

    let shellArgs = terminalOptions.shellArgs;
    assert(
      shellArgs !== undefined,
      'Expected shell arguments to exist'
    );
    shellArgs = shellArgs || [];

    assert(
      shellArgs[0].includes('mongodb://127.0.0.1') && shellArgs[0].includes('/?readPreference=primary&ssl=false'),
      `Expected open terminal to set shell arg as driver url with ssh tunnel port injected found "${shellArgs[0]}"`
    );

    await mockMDBExtension._connectionController.disconnect();
    mockMDBExtension._connectionController.clearAllConnections();
  });

  test('openMongoDBShell should open a terminal with ssl config injected', async () => {
    const driverUri =
      'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true';

    fakeGetActiveConnectionModel.returns(
      new Connection({
        hostname: '127.0.0.1',
        ssl: true,
        sslMethod: 'SERVER',
        sslCA: './path_to_some_file'
      })
    );
    fakeIsCurrentlyConnected.returns(true);

    await mockMDBExtension.openMongoDBShell();

    assert(createTerminalSpy.called);

    const terminalOptions: vscode.TerminalOptions =
      createTerminalSpy.firstCall.args[0];

    let shellArgs = terminalOptions.shellArgs;
    assert(
      shellArgs !== undefined,
      'Expected shell arguments to exist'
    );
    shellArgs = shellArgs || [];

    assert(
      shellArgs[0] === driverUri,
      `Expected open terminal to set shell arg as driver url with ssl injected "${driverUri}" found "${shellArgs[0]}"`
    );

    const expectedSSL = '--ssl --sslAllowInvalidHostnames --sslCAFile ./path_to_some_file';
    assert(
      shellArgs[1] === expectedSSL,
      `Expected open terminal to set ssl args as "${expectedSSL}" found "${shellArgs[1]}"`
    );

    await mockMDBExtension._connectionController.disconnect();
    mockMDBExtension._connectionController.clearAllConnections();
  });
});
