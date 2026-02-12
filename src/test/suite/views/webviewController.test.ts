import sinon from 'sinon';
import * as vscode from 'vscode';
import { expect } from 'chai';
import { before, after, beforeEach, afterEach } from 'mocha';
import fs from 'fs';
import path from 'path';

import ConnectionController from '../../../connectionController';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { MessageType } from '../../../views/webview-app/extension-app-message-constants';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TelemetryService } from '../../../telemetry';
import { ExtensionContextStub } from '../stubs';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import WebviewController, {
  getWebviewContent,
} from '../../../views/webviewController';
import * as linkHelper from '../../../utils/linkHelper';
import { waitFor } from '../waitFor';

suite('Webview Test Suite', function () {
  const sandbox = sinon.createSandbox();
  let extensionContextStub: ExtensionContextStub;
  let testStorageController: StorageController;
  let testTelemetryService: TelemetryService;
  let testConnectionController: ConnectionController;
  let testWebviewController: WebviewController;

  beforeEach(() => {
    extensionContextStub = new ExtensionContextStub();
    testStorageController = new StorageController(extensionContextStub);
    testTelemetryService = new TelemetryService(
      testStorageController,
      extensionContextStub,
    );
    testConnectionController = new ConnectionController({
      statusView: new StatusView(extensionContextStub),
      storageController: testStorageController,
      telemetryService: testTelemetryService,
    });
    testWebviewController = new WebviewController({
      connectionController: testConnectionController,
      storageController: testStorageController,
      telemetryService: testTelemetryService,
    });
    sandbox.stub(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackNewConnection',
    );
    sandbox.stub(testTelemetryService, 'trackNewConnection');
  });

  afterEach(() => {
    sandbox.restore();
  });

  test('it creates a web view panel and sets the html content', function () {
    const stubOnDidReceiveMessage = sandbox.stub();
    const fakeWebview = {
      html: '',
      onDidReceiveMessage: stubOnDidReceiveMessage,
      asWebviewUri: sandbox.stub().returns(''),
    } as unknown as vscode.Webview;
    const fakeVSCodeCreateWebviewPanel = sandbox
      .stub(vscode.window, 'createWebviewPanel')
      .returns({
        webview: fakeWebview,
        onDidDispose: sandbox.stub().returns(''),
      } as unknown as vscode.WebviewPanel);

    const testWebviewController = new WebviewController({
      connectionController:
        mdbTestExtension.testExtensionController._connectionController,
      storageController:
        mdbTestExtension.testExtensionController._storageController,
      telemetryService:
        mdbTestExtension.testExtensionController._telemetryService,
    });

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    expect(fakeVSCodeCreateWebviewPanel).to.be.calledOnce;
    expect(fakeWebview.html).to.not.equal('');
    expect(stubOnDidReceiveMessage).to.be.calledOnce;
  });

  test('web view content is rendered with the js form', async function () {
    async function readFile(filePath): Promise<string> {
      return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', function (err, data) {
          if (err) {
            reject(err);
          }
          resolve(data);
        });
      });
    }

    const extensionPath = mdbTestExtension.extensionContextStub.extensionPath;
    const htmlString = getWebviewContent({
      extensionPath,
      telemetryUserId: '',
      webview: {
        asWebviewUri: (jsUri) => {
          return jsUri;
        },
      } as unknown as vscode.Webview,
    });

    expect(htmlString).to.include('dist/webviewApp.js');

    const webviewAppFileName = (): string => 'dist/webviewApp.js';
    const jsFileString = await readFile(
      path.join(extensionPath, webviewAppFileName()),
    );

    expect(`${jsFileString}`).to.include('OverviewPage');
  });

  test('web view content sets the segment anonymous id globally', function () {
    const extensionPath = mdbTestExtension.extensionContextStub.extensionPath;
    const htmlString = getWebviewContent({
      extensionPath,
      telemetryUserId: 'MOCK_ANONYMOUS_ID',
      webview: {
        asWebviewUri: (jsUri) => {
          return jsUri;
        },
      } as unknown as vscode.Webview,
    });

    expect(htmlString).to.include(
      '>window.MDB_WEBVIEW_OPTIONS = {"segmentAnonymousId":"MOCK_ANONYMOUS_ID"',
    );
  });

  test('web view content sets the oidc device auth id globally', function () {
    const extensionPath = mdbTestExtension.extensionContextStub.extensionPath;
    const htmlString = getWebviewContent({
      extensionPath,
      telemetryUserId: 'test',
      webview: {
        asWebviewUri: (jsUri: vscode.Uri) => {
          return jsUri;
        },
      } as unknown as vscode.Webview,
    });

    expect(htmlString).to.include('"showOidcDeviceAuthFlow":false};</script>');
  });

  suite('when oidc device auth flow setting is enabled', function () {
    let originalDeviceAuthFlow;
    before(async function () {
      originalDeviceAuthFlow = vscode.workspace
        .getConfiguration('mdb')
        .get('showOIDCDeviceAuthFlow');

      await vscode.workspace
        .getConfiguration('mdb')
        .update(
          'showOIDCDeviceAuthFlow',
          true,
          vscode.ConfigurationTarget.Global,
        );
    });
    after(async function () {
      await vscode.workspace
        .getConfiguration('mdb')
        .update(
          'showOIDCDeviceAuthFlow',
          originalDeviceAuthFlow,
          vscode.ConfigurationTarget.Global,
        );
    });

    test('web view content sets the oidc device auth id globally', function () {
      const extensionPath = mdbTestExtension.extensionContextStub.extensionPath;
      const htmlString = getWebviewContent({
        extensionPath,
        telemetryUserId: 'test',
        webview: {
          asWebviewUri: (jsUri: vscode.Uri) => {
            return jsUri;
          },
        } as unknown as vscode.Webview,
      });

      expect(htmlString).to.include('"showOidcDeviceAuthFlow":true};</script>');
    });
  });

  test('web view listens for a connect message and adds the connection', function (done) {
    let messageReceivedSet = false;
    let messageReceived;
    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: async (): Promise<void> => {
          expect(testConnectionController.isCurrentlyConnected()).to.equal(
            true,
          );
          expect(testConnectionController.getActiveConnectionName()).to.include(
            'localhost:27088',
          );

          await testConnectionController.disconnect();
          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
          messageReceivedSet = true;
        },
        asWebviewUri: () => '',
      },
      onDidDispose: () => '',
    } as unknown as vscode.WebviewPanel);

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    expect(messageReceivedSet).to.be.true;

    // Mock a connection call.
    messageReceived({
      command: MessageType.connect,
      connectionInfo: {
        id: 2,
        connectionOptions: {
          connectionString: 'mongodb://localhost:27088',
        },
      },
    });
  });

  test('web view sends a successful connect result on a successful connection', function (done) {
    let messageReceivedSet = false;
    let messageReceived;
    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: async (message): Promise<void> => {
          expect(message.connectionSuccess).to.be.true;
          const expectedMessage = 'Successfully connected to localhost:27088.';
          expect(message.connectionMessage).to.equal(expectedMessage);

          await testConnectionController.disconnect();
          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
          messageReceivedSet = true;
        },
        asWebviewUri: () => '',
      },
      onDidDispose: () => '',
    } as unknown as vscode.WebviewPanel);

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    expect(messageReceivedSet).to.be.true;

    // Mock a connection call.
    messageReceived({
      command: MessageType.connect,
      connectionInfo: {
        id: 'pineapple',
        connectionOptions: {
          connectionString: 'mongodb://localhost:27088',
        },
      },
    });
  });

  test('web view sends an unsuccessful connect result on an unsuccessful connection', function (done) {
    let messageReceived;
    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: async (message): Promise<void> => {
          expect(message.connectionSuccess).to.be.false;
          expect(message.connectionMessage).to.include(
            'Unable to load connection',
          );

          await testConnectionController.disconnect();
          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: () => '',
      },
      onDidDispose: () => '',
    } as unknown as vscode.WebviewPanel);

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    // Mock a connection call.
    messageReceived({
      command: MessageType.connect,
      connectionInfo: {
        id: 'pineapple',
        connectionOptions: {
          // bad port number.
          connectionString: 'mongodb://localhost:2700002',
        },
      },
    });
  });

  test('web view sends an unsuccessful connect result on an attempt that is overridden', function (done) {
    this.timeout(5000);

    let messageReceived;
    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (message): void => {
          try {
            expect(message.connectionSuccess).to.be.false;
            expect(message.connectionMessage).to.include(
              'connection attempt cancelled',
            );

            void testConnectionController.disconnect();
            done();
          } catch (err) {
            done(err);
          }
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.fake.returns(''),
      },
      onDidDispose: sandbox.fake.returns(''),
    } as unknown as vscode.WebviewPanel);
    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    // Mock a connection call.
    messageReceived({
      command: MessageType.connect,
      connectionInfo: {
        id: 'pineapple',
        connectionOptions: {
          connectionString:
            'mongodb://shouldfail:27088?connectTimeoutMS=500&serverSelectionTimeoutMS=500&socketTimeoutMS=500',
        },
      },
    });

    void testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
  });

  test('web view runs the "connectWithURI" command when open connection string input is received', async function () {
    let messageReceived;
    const fakeWebview = {
      html: '',
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: (): string => '',
    };
    const fakeVSCodeExecuteCommand = sandbox
      .stub(vscode.commands, 'executeCommand')
      .resolves(false);

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: fakeWebview,
      onDidDispose: () => '',
    } as unknown as vscode.WebviewPanel);

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    messageReceived({
      command: MessageType.openConnectionStringInput,
    });

    await waitFor(() => {
      return fakeVSCodeExecuteCommand.called;
    });

    expect(fakeVSCodeExecuteCommand).to.be.called;
    expect(fakeVSCodeExecuteCommand.firstCall.args[0]).to.equal(
      'mdb.connectWithURI',
    );
  });

  test('webview returns the connection status on a connection status request', function (done) {
    let messageReceived;

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (message): void => {
          expect(message.command).to.equal('CONNECTION_STATUS_MESSAGE');
          expect(message.connectionStatus).to.equal('DISCONNECTED');
          expect(message.activeConnectionName).to.equal('');

          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.fake.returns(''),
      },
      onDidDispose: sandbox.fake.returns(''),
    } as unknown as vscode.WebviewPanel);

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    // Mock a connection status request call.
    messageReceived({
      command: MessageType.getConnectionStatus,
    });
  });

  test('webview returns the connection status on a connection status request when connected', function (done) {
    let messageReceived;

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: async (message): Promise<void> => {
          expect(message.command).to.equal('CONNECTION_STATUS_MESSAGE');
          expect(message.connectionStatus).to.equal('CONNECTED');
          expect(message.activeConnectionName).to.equal('localhost:27088');
          await testConnectionController.disconnect();

          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.fake.returns(''),
      },
      onDidDispose: sandbox.fake.returns(''),
    } as unknown as vscode.WebviewPanel);

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    void testConnectionController
      .addNewConnectionStringAndConnect({ connectionString: TEST_DATABASE_URI })
      .then(() => {
        // Mock a connection status request call.
        messageReceived({
          command: MessageType.getConnectionStatus,
        });
      });
  });

  test('calls to rename the active connection when a rename active connection message is passed', async function () {
    let messageReceived;

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (): void => {},
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.fake.returns(''),
      },
      onDidDispose: sandbox.fake.returns(''),
    } as unknown as vscode.WebviewPanel);

    const mockRenameConnectionOnConnectionController =
      sandbox.fake.returns(null);

    sandbox.replace(
      testConnectionController,
      'renameConnection',
      mockRenameConnectionOnConnectionController,
    );

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    // Mock a connection status request call.
    messageReceived({
      command: MessageType.renameActiveConnection,
    });

    expect(mockRenameConnectionOnConnectionController).to.be.calledOnce;
    expect(
      mockRenameConnectionOnConnectionController.firstCall.args[0],
    ).to.equal(testConnectionController.getActiveConnectionId());

    await testConnectionController.disconnect();
  });

  test('calls to edit a connection when an edit connection message is passed', async function () {
    let messageReceived;
    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (): void => {},
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.fake.returns(''),
      },
      onDidDispose: sandbox.fake.returns(''),
    } as unknown as vscode.WebviewPanel);

    const mockEditConnectionOnConnectionController = sandbox
      .stub(testConnectionController, 'updateConnectionAndConnect')
      .returns(
        Promise.resolve({
          successfullyConnected: true,
          connectionErrorMessage: '',
        }),
      );

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    // Mock a connection status request call.
    messageReceived({
      command: MessageType.editConnectionAndConnect,
      connectionInfo: {
        id: 'pineapple',
        connectionOptions: {
          connectionString: 'test',
        },
      },
    });

    expect(mockEditConnectionOnConnectionController).to.be.calledOnce;
    expect(
      mockEditConnectionOnConnectionController.firstCall.args[0],
    ).to.deep.equal({
      connectionId: 'pineapple',
      connectionOptions: {
        connectionString: 'test',
      },
    });

    await testConnectionController.disconnect();
  });

  test('it notifies all the webviews of the change of current theme and gulps the error if any', function (done) {
    const totalExpectedPostMessageCalls = 3;
    let callsSoFar = 0;
    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        // eslint-disable-next-line @typescript-eslint/require-await
        postMessage: async (message): Promise<void> => {
          expect(message.command).to.equal('THEME_CHANGED');
          expect(message.darkMode).to.be.true;
          if (++callsSoFar === 1) {
            // This should be fine since we catch the rejection and proceed ahead silently
            throw new Error('BAM');
          }
          if (++callsSoFar === totalExpectedPostMessageCalls) {
            done();
          }
        },
        onDidReceiveMessage: (): void => {},
        asWebviewUri: sandbox.fake.returns(''),
      },
      onDidDispose: sandbox.fake.returns(''),
    } as unknown as vscode.WebviewPanel);

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    void testWebviewController.openWebview(
      mdbTestExtension.extensionContextStub,
    );

    // Mock a theme change
    void testWebviewController.onThemeChanged({
      kind: vscode.ColorThemeKind.Dark,
    });
  });

  suite('with a rendered webview', function () {
    const extensionContextStub = new ExtensionContextStub();
    const testStorageController = new StorageController(extensionContextStub);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      extensionContextStub,
    );
    let messageReceived;

    beforeEach(() => {
      const testConnectionController = new ConnectionController({
        statusView: new StatusView(extensionContextStub),
        storageController: testStorageController,
        telemetryService: testTelemetryService,
      });

      sandbox.stub(vscode.window, 'createWebviewPanel').returns({
        webview: {
          html: '',
          postMessage: (): void => {},
          onDidReceiveMessage: (callback): void => {
            messageReceived = callback;
          },
          asWebviewUri: sandbox.fake.returns(''),
        },
        onDidDispose: sandbox.fake.returns(''),
      } as unknown as vscode.WebviewPanel);

      const testWebviewController = new WebviewController({
        connectionController: testConnectionController,
        storageController: testStorageController,
        telemetryService: testTelemetryService,
      });

      testWebviewController.openWebview(mdbTestExtension.extensionContextStub);
    });

    test('it should handle opening trusted links', function () {
      const stubOpenLink = sandbox.fake.resolves(null);
      sandbox.replace(linkHelper, 'openLink', stubOpenLink);

      messageReceived({
        command: MessageType.openTrustedLink,
        linkTo: 'https://mongodb.com/test',
      });

      expect(stubOpenLink).to.be.calledOnce;
      expect(stubOpenLink.firstCall.args[0]).to.equal(
        'https://mongodb.com/test',
      );
    });
  });
});
