import assert from 'assert';
import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';

import launchMongoShell from '../../../commands/launchMongoShell';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { parseConnectionModel } from '../../../views/webview-app/connection-model/connection-model';

suite('Commands Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const mockConnectionController =
    mdbTestExtension.testExtensionController._connectionController;
  const sandbox = sinon.createSandbox();

  let fakeShowErrorMessage: any;
  let fakeGetActiveConnectionModel: any;
  let fakeIsCurrentlyConnected: any;
  let createTerminalStub: any;
  let fakeSendTerminalText: any;

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');

    fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
    fakeGetActiveConnectionModel = sandbox.stub(
      mockConnectionController,
      'getActiveConnectionModel'
    );

    fakeIsCurrentlyConnected = sandbox.stub(
      mockConnectionController,
      'isCurrentlyConnected'
    );

    createTerminalStub = sandbox.stub();
    fakeSendTerminalText = sandbox.stub();

    createTerminalStub.returns({
      sendText: fakeSendTerminalText,
      show: () => {}
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
      const errorMessage =
        'You need to be connected before launching the MongoDB Shell.';

      fakeShowErrorMessage.resolves(errorMessage);

      try {
        await launchMongoShell(mockConnectionController);
      } catch (error) {
        sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
      }
    });

    test('openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const driverUri =
        'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: 'localhost',
          port: 27018
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      let shellArgs = terminalOptions.shellArgs;
      assert(shellArgs !== undefined, 'Expected shell arguments to exist');
      shellArgs = shellArgs || [];

      assert(
        shellArgs[0] === driverUri,
        `Expected open terminal to set shell arg as driver url "${driverUri}" found "${shellArgs[0]}"`
      );
    });

    test('openMongoDBShell should open a terminal with ssh tunnel port injected', async () => {
      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: '127.0.0.1',
          sshTunnel: 'USER_PASSWORD',
          sshTunnelHostname: 'my.ssh-server.com',
          sshTunnelUsername: 'my-user',
          sshTunnelPassword: 'password'
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      let shellArgs = terminalOptions.shellArgs;
      assert(shellArgs !== undefined, 'Expected shell arguments to exist');
      shellArgs = shellArgs || [];

      assert(
        shellArgs[0].includes('mongodb://127.0.0.1') &&
          shellArgs[0].includes('/?readPreference=primary&ssl=false'),
        `Expected open terminal to set shell arg as driver url with ssh tunnel port injected found "${shellArgs[0]}"`
      );
    });

    test('openMongoDBShell should open a terminal with ssl config injected', async () => {
      const driverUri =
        'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true';

      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: '127.0.0.1',
          ssl: true,
          sslMethod: 'SERVER',
          sslCA: './path_to_some_file'
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      let shellArgs = terminalOptions.shellArgs;
      assert(shellArgs !== undefined, 'Expected shell arguments to exist');
      shellArgs = shellArgs || [];

      assert(
        shellArgs[0] === driverUri,
        `Expected open terminal to set shell arg as driver url with ssl injected "${driverUri}" found "${shellArgs[0]}"`
      );

      assert(
        shellArgs[1] === '--tls',
        `Expected open terminal to set tls arg "--tls" found "${shellArgs[1]}"`
      );
      assert(
        shellArgs[2] === '--tlsAllowInvalidHostnames',
        `Expected open terminal to set tls arg "--tlsAllowInvalidHostnames" found "${shellArgs[2]}"`
      );
      assert(
        shellArgs[3] === '--tlsCAFile="./path_to_some_file"',
        `Expected open terminal to set tlsCAFile arg "--tlsCAFile="./path_to_some_file"" found "${shellArgs[3]}"`
      );
    });
  });

  suite('Windows powershell env shell', () => {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'powershell.exe');
    });

    test('powershell openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const driverUri =
        'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: 'localhost',
          port: 27018
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === driverUri,
        `Expected open terminal to set shell arg as driver url "${driverUri}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );

      const shellCommandText = fakeSendTerminalText.firstCall.args[0];
      assert(
        shellCommandText.includes('$Env:MDB_CONNECTION_STRING'),
        'Expected sendText to terminal to use powershell env variable syntax'
      );
    });

    test('powershell openMongoDBShell should open a terminal with ssh tunnel port injected', async () => {
      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: '127.0.0.1',
          sshTunnel: 'USER_PASSWORD',
          sshTunnelHostname: 'my.ssh-server.com',
          sshTunnelUsername: 'my-user',
          sshTunnelPassword: 'password'
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING?.includes(
          'mongodb://127.0.0.1'
        ) &&
          terminalOptions.env?.MDB_CONNECTION_STRING.includes(
            '/?readPreference=primary&ssl=false'
          ),
        `Expected open terminal to set shell arg as driver url with ssh tunnel port injected found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );
    });

    test('powershell openMongoDBShell should open a terminal with ssl config injected', async () => {
      const driverUri =
        'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true';

      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: '127.0.0.1',
          ssl: true,
          sslMethod: 'SERVER',
          sslCA: './path_to_some_file'
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === driverUri,
        `Expected open terminal to set shell arg as driver url with ssl injected "${driverUri}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );

      const shellCommandText = fakeSendTerminalText.firstCall.args[0];
      assert(
        shellCommandText.includes('--tls'),
        `Expected open terminal to have tls arg "--tls" found "${shellCommandText}"`
      );
      assert(
        shellCommandText.includes('--tlsAllowInvalidHostnames'),
        `Expected open terminal to have tls arg "--tlsAllowInvalidHostnames" found "${shellCommandText}"`
      );
      assert(
        shellCommandText.includes('--tlsCAFile="./path_to_some_file"'),
        `Expected open terminal to have tlsCAFile arg "--tlsCAFile="./path_to_some_file"" found "${shellCommandText}"`
      );
    });
  });

  suite('Windows cmd env shell', () => {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'cmd.exe');
    });

    test('windows cmd openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const driverUri =
        'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: 'localhost',
          port: 27018
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === driverUri,
        `Expected open terminal to set shell arg as driver url "${driverUri}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );
    });

    test('windows cmd openMongoDBShell should open a terminal with ssh tunnel port injected', async () => {
      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: '127.0.0.1',
          sshTunnel: 'USER_PASSWORD',
          sshTunnelHostname: 'my.ssh-server.com',
          sshTunnelUsername: 'my-user',
          sshTunnelPassword: 'password'
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING?.includes(
          'mongodb://127.0.0.1'
        ) &&
          terminalOptions.env?.MDB_CONNECTION_STRING.includes(
            '/?readPreference=primary&ssl=false'
          ),
        `Expected open terminal to set shell arg as driver url with ssh tunnel port injected found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );
    });

    test('windows cmd openMongoDBShell should open a terminal with ssl config injected', async () => {
      const driverUri =
        'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true';

      fakeGetActiveConnectionModel.returns(
        parseConnectionModel({
          hostname: '127.0.0.1',
          ssl: true,
          sslMethod: 'SERVER',
          sslCA: './path_to_some_file'
        })
      );
      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert(
        terminalOptions.env?.MDB_CONNECTION_STRING === driverUri,
        `Expected open terminal to set shell arg as driver url with ssl injected "${driverUri}" found "${terminalOptions.env?.MDB_CONNECTION_STRING}"`
      );

      const shellCommandText = fakeSendTerminalText.firstCall.args[0];
      assert(
        shellCommandText.includes('--tls'),
        `Expected open terminal to have tls arg "--tls" found "${shellCommandText}"`
      );
      assert(
        shellCommandText.includes('--tlsAllowInvalidHostnames'),
        `Expected open terminal to have tls arg "--tlsAllowInvalidHostnames" found "${shellCommandText}"`
      );
      assert(
        shellCommandText.includes('--tlsCAFile="./path_to_some_file"'),
        `Expected open terminal to have tlsCAFile arg "--tlsCAFile="./path_to_some_file"" found "${shellCommandText}"`
      );
    });
  });
});
