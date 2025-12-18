import * as vscode from 'vscode';
import { expect } from 'chai';
import { beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';

import launchMongoShell from '../../../commands/launchMongoShell';
import { mdbTestExtension } from '../stubbableMdbExtension';

suite('Commands Test Suite', function () {
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
      'getMongoClientConnectionOptions',
    );
    isCurrentlyConnectedStub = sandbox.stub(
      testConnectionController,
      'isCurrentlyConnected',
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

  suite('bash env shell', function () {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'bash');
    });

    test('openMongoDBShell should show an error message when not connected', async function () {
      const expectedMessage =
        'You need to be connected before launching the MongoDB Shell.';
      await launchMongoShell(testConnectionController);
      expect(showErrorMessageStub.firstCall.args[0]).to.equal(expectedMessage);
    });

    test('openMongoDBShell should open a terminal with the active connection driver url', async function () {
      const expectedDriverUrl =
        'mongodb://localhost:27088/?readPreference=primary&ssl=false';

      getMongoClientConnectionOptionsStub.returns({
        url: 'mongodb://localhost:27088/?readPreference=primary&ssl=false',
        options: {},
      });
      isCurrentlyConnectedStub.returns(true);

      await launchMongoShell(testConnectionController);

      expect(createTerminalStub.called).to.be.true;

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];
      expect(terminalOptions.env?.MDB_CONNECTION_STRING).to.equal(
        expectedDriverUrl,
      );
      expect(terminalOptions.env?.MDB_CONNECTION_STRING).to.equal(
        expectedDriverUrl,
      );

      const shellCommandText = sendTextStub.firstCall.args[0];
      expect(shellCommandText).to.equal('mongosh $MDB_CONNECTION_STRING;');
    });
  });

  suite('Windows powershell env shell', function () {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'powershell.exe');
    });

    test('powershell openMongoDBShell should open a terminal with the active connection driver url', async function () {
      const expectedDriverUrl =
        'mongodb://localhost:27088/?readPreference=primary&ssl=false';

      getMongoClientConnectionOptionsStub.returns({
        url: 'mongodb://localhost:27088/?readPreference=primary&ssl=false',
        options: {
          parentHandle: 'pineapple',
        },
      });

      isCurrentlyConnectedStub.returns(true);

      await launchMongoShell(testConnectionController);
      expect(createTerminalStub.called).to.be.true;

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];
      expect(terminalOptions.env?.MDB_CONNECTION_STRING).to.equal(
        expectedDriverUrl,
      );
      expect(terminalOptions.env?.MONGOSH_OIDC_PARENT_HANDLE).to.equal(
        'pineapple',
      );

      const shellCommandText = sendTextStub.firstCall.args[0];
      expect(shellCommandText).to.include('$Env:MDB_CONNECTION_STRING');
    });
  });

  suite('Windows cmd env shell', function () {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'cmd.exe');
    });

    test('windows cmd openMongoDBShell should open a terminal with the active connection driver url', async function () {
      const expectedDriverUrl =
        'mongodb://localhost:27088/?readPreference=primary&ssl=false';

      getMongoClientConnectionOptionsStub.returns({
        url: 'mongodb://localhost:27088/?readPreference=primary&ssl=false',
        options: {},
      });

      isCurrentlyConnectedStub.returns(true);

      await launchMongoShell(testConnectionController);
      expect(createTerminalStub.called).to.be.true;

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];
      expect(terminalOptions.env?.MDB_CONNECTION_STRING).to.equal(
        expectedDriverUrl,
      );
    });
  });
});
