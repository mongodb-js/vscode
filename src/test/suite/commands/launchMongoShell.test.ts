import * as vscode from 'vscode';
import assert from 'assert';
import { beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';

import launchMongoShell from '../../../commands/launchMongoShell';
import { mdbTestExtension } from '../stubbableMdbExtension';

suite('Commands Test Suite', () => {
  const testConnectionController =
    mdbTestExtension.testExtensionController._connectionController;

  let showErrorMessageStub: SinonStub;
  let getMongoClientConnectionOptionsStub: SinonStub;
  let isCurrentlyConnectedStub: SinonStub;
  let createTerminalStub: SinonStub;
  let sendTextStub: SinonSpy;

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
    getMongoClientConnectionOptionsStub = sandbox.stub(
      testConnectionController,
      'getMongoClientConnectionOptions'
    );
    isCurrentlyConnectedStub = sandbox.stub(
      testConnectionController,
      'isCurrentlyConnected'
    );
    createTerminalStub = sandbox.stub(vscode.window, 'createTerminal');
    sendTextStub = sandbox.stub();
    createTerminalStub.returns({
      sendText: sendTextStub,
      show: () => {},
    });
  });

  afterEach(async () => {
    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();
    sandbox.restore();
  });

  suite('bash env shell', () => {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'bash');
    });

    test('openMongoDBShell should show an error message when not connected', async () => {
      const expectedMessage =
        'You need to be connected before launching the MongoDB Shell.';
      await launchMongoShell(testConnectionController);
      assert(
        showErrorMessageStub.firstCall.args[0] === expectedMessage,
        `Expected the error message "${expectedMessage}" to be shown when attempting to add a database while disconnecting, found "${showErrorMessageStub.firstCall.args[0]}"`
      );
    });

    test('openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const expectedDriverUrl =
        'mongodb://localhost:27088/?readPreference=primary&ssl=false';

      getMongoClientConnectionOptionsStub.returns({
        url: 'mongodb://localhost:27088/?readPreference=primary&ssl=false',
        options: {},
      });
      isCurrentlyConnectedStub.returns(true);

      await launchMongoShell(testConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];
      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === expectedDriverUrl,
        `Expected open terminal to set shell arg as driver url "${expectedDriverUrl}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );

      const shellCommandText = sendTextStub.firstCall.args[0];
      assert.strictEqual(shellCommandText, 'mongosh $MDB_CONNECTION_STRING;');
    });
  });

  suite('Windows powershell env shell', () => {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'powershell.exe');
    });

    test('powershell openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const expectedDriverUrl =
        'mongodb://localhost:27088/?readPreference=primary&ssl=false';

      getMongoClientConnectionOptionsStub.returns({
        url: 'mongodb://localhost:27088/?readPreference=primary&ssl=false',
        options: {},
      });

      isCurrentlyConnectedStub.returns(true);

      await launchMongoShell(testConnectionController);
      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];
      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === expectedDriverUrl,
        `Expected open terminal to set shell arg as driver url "${expectedDriverUrl}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );

      const shellCommandText = sendTextStub.firstCall.args[0];
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
      const expectedDriverUrl =
        'mongodb://localhost:27088/?readPreference=primary&ssl=false';

      getMongoClientConnectionOptionsStub.returns({
        url: 'mongodb://localhost:27088/?readPreference=primary&ssl=false',
        options: {},
      });

      isCurrentlyConnectedStub.returns(true);

      await launchMongoShell(testConnectionController);
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
