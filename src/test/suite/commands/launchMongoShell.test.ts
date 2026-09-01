import * as vscode from 'vscode';
import { expect } from 'chai';
import { beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';

import launchMongoShell from '../../../commands/launchMongoShell';
import { mdbTestExtension } from '../stubbableMdbExtension';
import type ConnectionController from '../../../connectionController';

suite('Commands Test Suite', function () {
  let testConnectionController: ConnectionController;
  let showErrorMessageStub: SinonStub;
  let getMongoClientConnectionOptionsStub: SinonStub;
  let isCurrentlyConnectedStub: SinonStub;
  let createTerminalStub: SinonStub;
  let sendTextStub: SinonSpy;

  let sandbox: sinon.SinonSandbox;

  beforeEach(function () {
    testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    sandbox = sinon.createSandbox();
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

  afterEach(async function () {
    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();
    sandbox.restore();
  });

  suite('bash env shell', function () {
    beforeEach(function () {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'bash');
    });

    test('openMongoDBShell should show an error message when not connected', async function () {
      const expectedMessage =
        'You need to be connected before launching the MongoDB Shell.';
      await launchMongoShell(testConnectionController);
      expect(showErrorMessageStub.firstCall.args[0]).to.equal(expectedMessage);
    });

    suite('when connected', function () {
      const expectedDriverUrl =
        'mongodb://localhost:27088/?readPreference=primary&ssl=false';
      beforeEach(function () {
        getMongoClientConnectionOptionsStub.returns({
          url: expectedDriverUrl,
          options: {},
        });
        isCurrentlyConnectedStub.returns(true);
      });

      test('openMongoDBShell should show an error message when an invalid shell command is specified', async function () {
        const expectedMessage =
          'Invalid MongoDB shell command specified. Please set the shell command to "mongo" or "mongosh" in the MongoDB extension settings.';
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
          get: () => 'invalidShellCommand',
        } as unknown as vscode.WorkspaceConfiguration);
        await launchMongoShell(testConnectionController);
        expect(showErrorMessageStub.firstCall.args[0]).to.equal(
          expectedMessage,
        );
      });

      test('openMongoDBShell should show an error message when no shell command is specified', async function () {
        const expectedMessage =
          'No MongoDB shell command found. Please set the shell command in the MongoDB extension settings.';
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
          get: () => '',
        } as unknown as vscode.WorkspaceConfiguration);
        await launchMongoShell(testConnectionController);
        expect(showErrorMessageStub.firstCall.args[0]).to.equal(
          expectedMessage,
        );
      });

      test('openMongoDBShell should open a terminal with the active connection driver url', async function () {
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
        expect(shellCommandText).to.equal('mongosh "$MDB_CONNECTION_STRING";');

        expect(showErrorMessageStub.called).to.be.false;
      });

      test('openMongoDBShell should reject a connection string containing a double quote', async function () {
        getMongoClientConnectionOptionsStub.returns({
          url: 'mongodb://cluster0.example.com/?appName=x"|calc.exe',
          options: {},
        });

        await launchMongoShell(testConnectionController);

        expect(createTerminalStub.called).to.be.false;
        expect(showErrorMessageStub.firstCall.args[0]).to.equal(
          'The connection string contains unsupported characters (quotes or line breaks) and cannot be used to launch the MongoDB Shell.',
        );
      });

      test('openMongoDBShell should reject a connection string containing a newline', async function () {
        getMongoClientConnectionOptionsStub.returns({
          url: 'mongodb://cluster0.example.com/?appName=x\ncalc.exe',
          options: {},
        });

        await launchMongoShell(testConnectionController);

        expect(createTerminalStub.called).to.be.false;
        expect(showErrorMessageStub.firstCall.args[0]).to.equal(
          'The connection string contains unsupported characters (quotes or line breaks) and cannot be used to launch the MongoDB Shell.',
        );
      });
    });
  });

  suite('Windows powershell env shell', function () {
    beforeEach(function () {
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
      expect(shellCommandText).to.include('"$Env:MDB_CONNECTION_STRING"');
    });
  });

  suite('PowerShell 7 (pwsh) env shell', function () {
    beforeEach(function () {
      sandbox.replaceGetter(
        vscode.env,
        'shell',
        () => 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      );
    });

    test('pwsh openMongoDBShell should open a terminal with the active connection driver url', async function () {
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
      expect(shellCommandText).to.include('"$Env:MDB_CONNECTION_STRING"');
    });
  });

  suite('mixed case Windows shell paths', function () {
    const expectedDriverUrl =
      'mongodb://localhost:27088/?readPreference=primary&ssl=false';

    beforeEach(function () {
      getMongoClientConnectionOptionsStub.returns({
        url: expectedDriverUrl,
        options: {},
      });
      isCurrentlyConnectedStub.returns(true);
    });

    const testCases: {
      shell: string;
      expectedEnvVariable: string;
    }[] = [
      {
        shell: 'C:\\Program Files\\PowerShell\\7\\Pwsh.exe',
        expectedEnvVariable: '"$Env:MDB_CONNECTION_STRING"',
      },
      {
        shell: 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\PowerShell.exe',
        expectedEnvVariable: '"$Env:MDB_CONNECTION_STRING"',
      },
      {
        shell: 'C:\\WINDOWS\\System32\\CMD.EXE',
        expectedEnvVariable: '"%MDB_CONNECTION_STRING%"',
      },
      {
        shell: 'C:\\Program Files\\Git\\bin\\Bash.exe',
        expectedEnvVariable: '"$MDB_CONNECTION_STRING"',
      },
    ];

    for (const { shell, expectedEnvVariable } of testCases) {
      test(`openMongoDBShell matches ${shell} regardless of casing`, async function () {
        sandbox.replaceGetter(vscode.env, 'shell', () => shell);

        await launchMongoShell(testConnectionController);

        expect(createTerminalStub.called).to.be.true;
        expect(sendTextStub.firstCall.args[0]).to.equal(
          `mongosh ${expectedEnvVariable};`,
        );
      });
    }
  });

  suite('Windows cmd env shell', function () {
    beforeEach(function () {
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

    test('windows cmd openMongoDBShell should quote the connection string so pipe/redirect payloads are inert', async function () {
      getMongoClientConnectionOptionsStub.returns({
        url: 'mongodb://cluster0.example.com/?appName=x|calc.exe',
        options: {},
      });

      isCurrentlyConnectedStub.returns(true);

      await launchMongoShell(testConnectionController);

      const shellCommandText = sendTextStub.firstCall.args[0];
      expect(shellCommandText).to.equal('mongosh "%MDB_CONNECTION_STRING%";');
    });
  });
});
