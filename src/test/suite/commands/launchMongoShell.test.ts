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
  let fakeGetActiveDerivedConnectionModel: any;
  let fakeIsCurrentlyConnected: any;
  let createTerminalStub: any;
  let fakeSendTerminalText: any;

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');

    fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
    fakeGetActiveDerivedConnectionModel = sandbox.stub(
      mockConnectionController,
      'getActiveDerivedConnectionModel'
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
      const driverUri = 'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: 'localhost:27018',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverUrl: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverUrlWithSsh: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverOptions: { readPreference: 'primary' },
        sshTunnelOptions: {},
        username: '',
        title: 'localhost:27018'
      });
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

      assert.strictEqual(shellCommandText, 'mongosh $MDB_CONNECTION_STRING;');
    });

    test('openMongoDBShell should open a terminal with ssh tunnel port injected', async () => {
      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: '127.0.0.1:27017',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=false',
        driverUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=false',
        driverUrlWithSsh: 'mongodb://127.0.0.1:29309/?readPreference=primary&ssl=false',
        driverOptions: { readPreference: 'primary' },
        sshTunnelOptions: {
          readyTimeout: 20000,
          forwardTimeout: 20000,
          keepaliveInterval: 20000,
          srcAddr: '127.0.0.1',
          dstPort: 27017,
          dstAddr: '127.0.0.1',
          localPort: 29309,
          localAddr: '127.0.0.1',
          host: 'my.ssh-server.com',
          port: 22,
          username: 'my-user',
          password: 'password'
        },
        username: '',
        title: '127.0.0.1:27017'
      });

      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const connectionString: string =
        createTerminalStub.firstCall.args[0].env?.MDB_CONNECTION_STRING;

      assert(connectionString.includes('mongodb://127.0.0.1'));
      assert(!connectionString.includes('27017'));
      assert(connectionString.includes('?readPreference=primary&ssl=false'));

      const shellCommandText = fakeSendTerminalText.firstCall.args[0];

      assert.strictEqual(shellCommandText, 'mongosh $MDB_CONNECTION_STRING;');
    });

    test('openMongoDBShell should open a terminal with ssl config injected', async () => {
      const driverUri = 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true';

      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: '127.0.0.1:27017',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverUrlWithSsh: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverOptions: {
          sslValidate: true,
          sslCA: ['./path_to_some_file'],
          readPreference: 'primary'
        },
        sshTunnelOptions: {},
        username: '',
        title: '127.0.0.1:27017'
      });

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

      assert.strictEqual(shellCommandText, 'mongosh --tls --tlsAllowInvalidHostnames --tlsCAFile="./path_to_some_file" $MDB_CONNECTION_STRING;');
    });

    test('openMongoDBShell should open a terminal with x509 config injected', async () => {
      const driverUri = 'mongodb://testing@localhost:27017/?authMechanism=MONGODB-X509&readPreference=primary&ssl=true&authSource=%24external';

      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: 'localhost:27017',
        driverAuthMechanism: 'MONGODB-X509',
        safeUrl: 'mongodb://testing@localhost:27017/?authMechanism=MONGODB-X509&readPreference=primary&ssl=true&authSource=%24external',
        driverUrl: 'mongodb://testing@localhost:27017/?authMechanism=MONGODB-X509&readPreference=primary&ssl=true&authSource=%24external',
        driverUrlWithSsh: 'mongodb://testing@localhost:27017/?authMechanism=MONGODB-X509&readPreference=primary&ssl=true&authSource=%24external',
        driverOptions: {
          sslValidate: false,
          sslCA: ['./path/to/ca'],
          sslKey: './path/to/key',
          sslCert: './path/to/cert',
          tlsAllowInvalidHostnames: true,
          readPreference: 'primary'
        },
        sshTunnelOptions: {},
        username: 'testing',
        title: 'localhost:27017'
      });

      fakeIsCurrentlyConnected.returns(true);

      await launchMongoShell(mockConnectionController);

      assert(createTerminalStub.called);

      const terminalOptions: vscode.TerminalOptions =
        createTerminalStub.firstCall.args[0];

      assert.strictEqual(terminalOptions.env?.MDB_CONNECTION_STRING, driverUri);

      const shellCommandText = fakeSendTerminalText.firstCall.args[0];

      assert.strictEqual(shellCommandText, 'mongosh --tls --tlsAllowInvalidHostnames --tlsCAFile="./path/to/ca" --tlsCertificateKeyFile="./path/to/cert" $MDB_CONNECTION_STRING;');
    });
  });

  suite('Windows powershell env shell', () => {
    beforeEach(() => {
      sandbox.replaceGetter(vscode.env, 'shell', () => 'powershell.exe');
    });

    test('powershell openMongoDBShell should open a terminal with the active connection driver url', async () => {
      const driverUri = 'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: 'localhost:27018',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverUrl: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverUrlWithSsh: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverOptions: { readPreference: 'primary' },
        sshTunnelOptions: {},
        username: '',
        title: 'localhost:27018'
      });

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
        `Expected sendText to terminal (${shellCommandText}) to use powershell env variable syntax`
      );
    });

    test('powershell openMongoDBShell should open a terminal with ssh tunnel port injected', async () => {
      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: '127.0.0.1:27017',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=false',
        driverUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=false',
        driverUrlWithSsh: 'mongodb://127.0.0.1:29500/?readPreference=primary&ssl=false',
        driverOptions: { readPreference: 'primary' },
        sshTunnelOptions: {
          readyTimeout: 20000,
          forwardTimeout: 20000,
          keepaliveInterval: 20000,
          srcAddr: '127.0.0.1',
          dstPort: 27017,
          dstAddr: '127.0.0.1',
          localPort: 29500,
          localAddr: '127.0.0.1',
          host: 'my.ssh-server.com',
          port: 22,
          username: 'my-user',
          password: 'password'
        },
        username: '',
        title: '127.0.0.1:27017'
      });

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
      const driverUri = 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true';

      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: '127.0.0.1:27017',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverUrlWithSsh: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverOptions: {
          sslValidate: true,
          sslCA: ['./path_to_some_file'],
          readPreference: 'primary'
        },
        sshTunnelOptions: {},
        username: '',
        title: '127.0.0.1:27017'
      });

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
      const driverUri = 'mongodb://localhost:27018/?readPreference=primary&ssl=false';

      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: 'localhost:27018',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverUrl: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverUrlWithSsh: 'mongodb://localhost:27018/?readPreference=primary&ssl=false',
        driverOptions: { readPreference: 'primary' },
        sshTunnelOptions: {},
        username: '',
        title: 'localhost:27018'
      });

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
      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: '127.0.0.1:27017',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=false',
        driverUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=false',
        driverUrlWithSsh: 'mongodb://127.0.0.1:29278/?readPreference=primary&ssl=false',
        driverOptions: { readPreference: 'primary' },
        sshTunnelOptions: {
          readyTimeout: 20000,
          forwardTimeout: 20000,
          keepaliveInterval: 20000,
          srcAddr: '127.0.0.1',
          dstPort: 27017,
          dstAddr: '127.0.0.1',
          localPort: 29278,
          localAddr: '127.0.0.1',
          host: 'my.ssh-server.com',
          port: 22,
          username: 'my-user',
          password: 'password'
        },
        username: '',
        title: '127.0.0.1:27017'
      });

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
      const driverUri = 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true';

      fakeGetActiveDerivedConnectionModel.returns({
        instanceId: '127.0.0.1:27017',
        driverAuthMechanism: undefined,
        safeUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverUrl: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverUrlWithSsh: 'mongodb://127.0.0.1:27017/?readPreference=primary&ssl=true',
        driverOptions: {
          sslValidate: true,
          sslCA: ['./path_to_some_file'],
          readPreference: 'primary'
        },
        sshTunnelOptions: {},
        username: '',
        title: '127.0.0.1:27017'
      });

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
