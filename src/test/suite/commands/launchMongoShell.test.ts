import * as vscode from 'vscode';
import * as sinon from 'sinon';
import assert from 'assert';
import { beforeEach, afterEach } from 'mocha';

import launchMongoShell from '../../../commands/launchMongoShell';
import { mdbTestExtension } from '../stubbableMdbExtension';

suite('Commands Test Suite', () => {
  void vscode.window.showInformationMessage('Starting tests...');

  const mockConnectionController =
    mdbTestExtension.testExtensionController._connectionController;
  const sandbox = sinon.createSandbox();

  let fakeShowErrorMessage: any;
  let fakeGetMongoClientConnectionOptions: any;
  let fakeIsCurrentlyConnected: any;
  let createTerminalStub: any;
  let fakeSendTerminalText: any;

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');

    fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
    fakeGetMongoClientConnectionOptions = sandbox.stub(
      mockConnectionController,
      'getMongoClientConnectionOptions'
    );

    fakeIsCurrentlyConnected = sandbox.stub(
      mockConnectionController,
      'isCurrentlyConnected'
    );

    createTerminalStub = sandbox.stub();
    fakeSendTerminalText = sandbox.stub();

    createTerminalStub.returns({
      sendText: fakeSendTerminalText,
      show: () => { }
    });
    sandbox.replace(vscode.window, 'createTerminal', createTerminalStub);
  });

  afterEach(async () => {
    sandbox.restore();
    sinon.restore();

    await mockConnectionController.disconnect();
    mockConnectionController.clearAllConnections();
  });

  suite('bash env shell', () => {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'bash');
    });

    test('openMongoDBShell should display an error message when not connected', async () => {
      const errorMessage = 'You need to be connected before launching the MongoDB Shell.';

      fakeShowErrorMessage.resolves(errorMessage);

      try {
        await launchMongoShell(mockConnectionController);
      } catch (error) {
        sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
      }
    });

    test('openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const expectedDriverUrl = 'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetMongoClientConnectionOptions.returns({
        url: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        options: {}
      });
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === expectedDriverUrl,
        `Expected open terminal to set shell arg as driver url "${expectedDriverUrl}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );

      const shellCommandText = fakeSendTerminalText.firstCall.args[0];

      assert.strictEqual(shellCommandText, 'mongosh $MDB_CONNECTION_STRING;');
    });
  });

  suite('Windows powershell env shell', () => {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'powershell.exe');
    });

    test('powershell openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const expectedDriverUrl = 'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetMongoClientConnectionOptions.returns({
        url: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        options: {},
      });

      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === expectedDriverUrl,
        `Expected open terminal to set shell arg as driver url "${expectedDriverUrl}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );

      const shellCommandText = fakeSendTerminalText.firstCall.args[0];
      assert(
        shellCommandText.includes('$Env:MDB_CONNECTION_STRING'),
        `Expected sendText to terminal (${shellCommandText}) to use powershell env variable syntax`
      );
    });
  });

  suite('Windows cmd env shell', () => {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'cmd.exe');
    });

    test('windows cmd openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const expectedDriverUrl = 'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetMongoClientConnectionOptions.returns({
        url: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        options: {}
      });

      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === expectedDriverUrl,
        `Expected open terminal to set shell arg as driver url "${expectedDriverUrl}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );
    });
  });
});
