import * as linkHelper from '../../../utils/linkHelper';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import assert from 'assert';
import { beforeEach, afterEach } from 'mocha';

import ConnectionController from '../../../connectionController';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { MESSAGE_TYPES } from '../../../views/webview-app/extension-app-message-constants';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { TestExtensionContext } from '../stubs';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import WebviewController, {
  getWebviewContent,
} from '../../../views/webviewController';

const fs = require('fs');
const path = require('path');

suite('Webview Test Suite', () => {
  afterEach(() => {
    sinon.restore();
  });

  test('it creates a web view panel and sets the html content', () => {
    const stubOnDidRecieveMessage = sinon.stub();
    const fakeWebview = {
      html: '',
      onDidReceiveMessage: stubOnDidRecieveMessage,
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      mdbTestExtension.testExtensionController._connectionController,
      mdbTestExtension.testExtensionController._storageController,
      mdbTestExtension.testExtensionController._telemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    assert(fakeVSCodeCreateWebviewPanel.called);
    assert(fakeWebview.html !== '');
    assert(
      stubOnDidRecieveMessage.called,
      'Ensure it starts listening for messages from the webview.'
    );
  });

  test('web view content is rendered with the js form', async () => {
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

    const fakeWebview: any = {
      asWebviewUri: (jsUri) => {
        return jsUri;
      },
    };

    const extensionPath = mdbTestExtension.testExtensionContext.extensionPath;
    const htmlString = getWebviewContent({
      extensionPath,
      telemetryUserId: '',
      webview: fakeWebview,
    });

    assert(htmlString.includes('dist/webviewApp.js'));

    const webviewAppFileName = (): string => 'dist/webviewApp.js';
    const jsFileString = await readFile(
      path.join(extensionPath, webviewAppFileName())
    );

    assert(`${jsFileString}`.includes('OverviewPage'));
  });

  test('web view content sets the segment anonymous id globally', () => {
    const fakeWebview: any = {
      asWebviewUri: (jsUri) => {
        return jsUri;
      },
    };

    const extensionPath = mdbTestExtension.testExtensionContext.extensionPath;
    const htmlString = getWebviewContent({
      extensionPath,
      telemetryUserId: 'MOCK_ANONYMOU_ID',
      webview: fakeWebview,
    });

    assert(
      htmlString.includes(
        ">window['VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID'] = 'MOCK_ANONYMOU_ID';"
      )
    );
  });

  test('web view listens for a connect message and adds the connection', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceivedSet = false;
    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: async (): Promise<void> => {
        assert(testConnectionController.isCurrentlyConnected());
        assert(
          testConnectionController.getActiveConnectionName() ===
            'localhost:27018'
        );

        await testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
        messageReceivedSet = true;
      },
      asWebviewUri: sinon.fake.returns(''),
    };

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    assert(
      messageReceivedSet,
      'Ensure it starts listening for messages from the webview.'
    );

    // Mock a connection call.
    messageReceived({
      command: MESSAGE_TYPES.CONNECT,
      connectionModel: {
        port: 27018,
        hostname: 'localhost',
        hosts: [{ host: 'localhost', port: 27018 }],
      },
    });
  });

  test('web view sends a successful connect result on a successful connection', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceivedSet = false;
    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: async (message): Promise<void> => {
        assert(message.connectionSuccess);
        const expectedMessage = 'Successfully connected to localhost:27018.';
        assert(
          message.connectionMessage === expectedMessage,
          `Expected connection message "${message.connectionMessage}" to equal ${expectedMessage}`
        );

        await testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
        messageReceivedSet = true;
      },
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    assert(
      messageReceivedSet,
      'Ensure it starts listening for messages from the webview.'
    );

    // Mock a connection call.
    messageReceived({
      command: MESSAGE_TYPES.CONNECT,
      connectionModel: {
        port: 27018,
        hostname: 'localhost',
        hosts: [{ host: 'localhost', port: 27018 }],
      },
    });
  });

  test('web view sends an unsuccessful connect result on an unsuccessful connection', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: async (message): Promise<void> => {
        assert(!message.connectionSuccess);
        assert(message.connectionMessage.includes('Unable to load connection'));

        await testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    // Mock a connection call.
    messageReceived({
      command: MESSAGE_TYPES.CONNECT,
      connectionModel: {
        port: 2700002, // Bad port number.
        hostname: 'localhost',
      },
    });
  });

  test('web view sends an unsuccessful connect result on an attempt that is overridden', function (done) {
    this.timeout(5000);

    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: (message): void => {
        assert(!message.connectionSuccess);
        const expectedMessage = 'connection attempt overriden';
        assert(
          message.connectionMessage === expectedMessage,
          `Expected connection message "${message.connectionMessage}" to equal ${expectedMessage}`
        );

        void testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );
    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );
    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    // Mock a connection call.
    messageReceived({
      command: MESSAGE_TYPES.CONNECT,
      connectionModel: {
        port: 27018,
        hostname: 'shouldfail',
        connectTimeoutMS: 500,
        socketTimeoutMS: 500,
        serverSelectionTimeoutMS: 500,
      },
    });

    void testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
  });

  test('web view opens file picker on file picker request', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    const fakeVSCodeOpenDialog = sinon.fake.resolves({
      path: '/somefilepath/test.text',
    });

    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: async (): Promise<void> => {
        assert(fakeVSCodeOpenDialog.called);
        assert(fakeVSCodeOpenDialog.firstCall.args[0].canSelectFiles);

        await testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: sinon.fake.returns(''),
    };

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    sinon.replace(vscode.window, 'showOpenDialog', fakeVSCodeOpenDialog);

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    // Mock a connection call.
    messageReceived({
      command: MESSAGE_TYPES.OPEN_FILE_PICKER,
      action: 'file_action',
    });
  });

  test('web view returns file name on file picker request', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: async (message): Promise<void> => {
        try {
          assert.strictEqual(message.action, 'file_action');
          assert.strictEqual(message.files[0], '/somefilepath/test.text');

          done();
        } catch (e) {
          done(e);
        }

        await testConnectionController.disconnect();
      },
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const fakeVSCodeOpenDialog = sinon.fake.resolves([
      {
        fsPath: '/somefilepath/test.text',
      },
    ]);

    sinon.replace(vscode.window, 'showOpenDialog', fakeVSCodeOpenDialog);

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    messageReceived({
      command: MESSAGE_TYPES.OPEN_FILE_PICKER,
      action: 'file_action',
    });
  });

  test('web view runs the "connectWithURI" command when open connection string input is recieved', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceived;
    const fakeWebview = {
      html: '',
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeExecuteCommand = sinon.fake.resolves(false);

    sinon.replace(vscode.commands, 'executeCommand', fakeVSCodeExecuteCommand);

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    messageReceived({
      command: MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT,
    });

    setTimeout(() => {
      assert(fakeVSCodeExecuteCommand.called);
      assert(
        fakeVSCodeExecuteCommand.firstCall.args[0] === 'mdb.connectWithURI'
      );

      done();
    }, 50);
  });

  test('webview returns the connection status on a connection status request', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: (message): void => {
        assert(message.command === 'CONNECTION_STATUS_MESSAGE');
        assert(message.connectionStatus === 'DISCONNECTED');
        assert(message.activeConnectionName === '');

        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    // Mock a connection status request call.
    messageReceived({
      command: MESSAGE_TYPES.GET_CONNECTION_STATUS,
    });
  });

  test('webview returns the connection status on a connection status request', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: async (message): Promise<void> => {
        assert(message.command === 'CONNECTION_STATUS_MESSAGE');
        assert(message.connectionStatus === 'CONNECTED');
        assert(message.activeConnectionName === 'localhost:27018');
        await testConnectionController.disconnect();

        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    void testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(() => {
        // Mock a connection status request call.
        messageReceived({
          command: MESSAGE_TYPES.GET_CONNECTION_STATUS,
        });
      });
  });

  test('calls to rename the active connection when a rename active connection message is passed', async () => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController,
      testTelemetryService
    );
    let messageReceived;
    const fakeWebview = {
      html: '',
      postMessage: (): void => {},
      onDidReceiveMessage: (callback): void => {
        messageReceived = callback;
      },
      asWebviewUri: sinon.fake.returns(''),
    };
    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview,
    });

    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const mockRenameConnectionOnConnectionController = sinon.fake.returns(null);

    sinon.replace(
      testConnectionController,
      'renameConnection',
      mockRenameConnectionOnConnectionController
    );

    const testWebviewController = new WebviewController(
      testConnectionController,
      testStorageController,
      testTelemetryService
    );

    void testWebviewController.openWebview(
      mdbTestExtension.testExtensionContext
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    // Mock a connection status request call.
    messageReceived({
      command: MESSAGE_TYPES.RENAME_ACTIVE_CONNECTION,
    });

    assert(mockRenameConnectionOnConnectionController.called);
    assert.strictEqual(
      mockRenameConnectionOnConnectionController.firstCall.args[0],
      testConnectionController.getActiveConnectionId()
    );

    await testConnectionController.disconnect();
  });

  suite('with a rendered webview', () => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testTelemetryService = new TelemetryService(
      testStorageController,
      testExtensionContext
    );
    let testConnectionController;

    let messageReceived;
    let fakeWebview;

    let testWebviewController;

    beforeEach(() => {
      testConnectionController = new ConnectionController(
        new StatusView(testExtensionContext),
        testStorageController,
        testTelemetryService
      );

      fakeWebview = {
        html: '',
        postMessage: (): void => {},
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sinon.fake.returns(''),
      };

      const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
        webview: fakeWebview,
      });
      sinon.replace(
        vscode.window,
        'createWebviewPanel',
        fakeVSCodeCreateWebviewPanel
      );

      testWebviewController = new WebviewController(
        testConnectionController,
        testStorageController,
        testTelemetryService
      );

      testWebviewController.openWebview(mdbTestExtension.testExtensionContext);
    });

    test('it should handle opening trusted links', () => {
      const stubOpenLink = sinon.fake.resolves(null);
      sinon.replace(linkHelper, 'openLink', stubOpenLink);

      messageReceived({
        command: MESSAGE_TYPES.OPEN_TRUSTED_LINK,
        linkTo: 'https://mongodb.com/test',
      });

      assert(stubOpenLink.called);
      assert.strictEqual(
        stubOpenLink.firstCall.args[0],
        'https://mongodb.com/test'
      );
    });
  });
});
