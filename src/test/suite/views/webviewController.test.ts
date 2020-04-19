import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';
const fs = require('fs');
const path = require('path');
import Connection = require('mongodb-connection-model/lib/model');

import ConnectionController from '../../../connectionController';
import { StorageController } from '../../../storage';
import WebviewController, {
  getConnectWebviewContent,
  getReactAppUri
} from '../../../views/webviewController';
import { StatusView } from '../../../views';
import { MESSAGE_TYPES } from '../../../views/webview-app/extension-app-message-constants';

import { mdbTestExtension } from '../stubbableMdbExtension';
import { TestExtensionContext } from '../stubs';
import { TEST_DATABASE_URI } from '../dbTestHelper';

suite('Connect Form View Test Suite', () => {
  const disposables: vscode.Disposable[] = [];

  afterEach(() => {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;

    sinon.restore();
  });

  test('it creates a web view panel and sets the html content', () => {
    const stubOnDidRecieveMessage = sinon.stub();
    const fakeWebview = {
      html: '',
      onDidReceiveMessage: stubOnDidRecieveMessage
    };

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      mdbTestExtension.testExtensionController._connectionController
    );

    testWebviewController.showConnectForm(
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

    const extensionPath = mdbTestExtension.testExtensionContext.extensionPath;
    const appUri = getReactAppUri(extensionPath);
    const htmlString = getConnectWebviewContent(appUri);

    assert(htmlString.includes('vscode-resource:/dist/webviewApp.js'));
    const webviewAppFileName = (): string => 'dist/webviewApp.js';
    const jsFileString = await readFile(
      path.resolve(__dirname, '..', '..', '..', '..', webviewAppFileName())
    );
    assert(`${jsFileString}`.includes('ConnectionForm'));
  });

  test('web view listens for a connect message and adds the connection', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController
    );

    let messageRecievedSet = false;
    let messageRecieved;
    const fakeWebview = {
      html: '',
      postMessage: (message: any): void => {
        assert(testConnectionController.isCurrentlyConnected());
        assert(
          testConnectionController.getActiveConnectionName() ===
            'localhost:27018'
        );
        assert(
          testConnectionController.getActiveConnectionModel()?.port === 27018
        );

        testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageRecieved = callback;
        messageRecievedSet = true;
      }
    };

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController
    );

    testWebviewController.showConnectForm(
      mdbTestExtension.testExtensionContext
    );

    assert(
      messageRecievedSet,
      'Ensure it starts listening for messages from the webview.'
    );

    Connection.from(TEST_DATABASE_URI, (err, connectionModel) => {
      if (err) {
        assert(false);
      }

      // Mock a connection call.
      messageRecieved({
        command: MESSAGE_TYPES.CONNECT,
        connectionModel: {
          port: connectionModel.port,
          hostname: connectionModel.hostname
        }
      });
    });
  });

  test('web view sends a successful connect result on a successful connection', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController
    );

    let messageRecievedSet = false;
    let messageRecieved;
    const fakeWebview = {
      html: '',
      postMessage: (message: any): void => {
        assert(message.connectionSuccess);
        assert(message.connectionMessage === 'Connected.');

        testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageRecieved = callback;
        messageRecievedSet = true;
      }
    };

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController
    );

    testWebviewController.showConnectForm(
      mdbTestExtension.testExtensionContext
    );

    assert(
      messageRecievedSet,
      'Ensure it starts listening for messages from the webview.'
    );

    Connection.from(TEST_DATABASE_URI, (err, connectionModel) => {
      if (err) {
        assert(false);
      }

      // Mock a connection call.
      messageRecieved({
        command: MESSAGE_TYPES.CONNECT,
        connectionModel: {
          port: connectionModel.port,
          hostname: connectionModel.hostname
        }
      });
    });
  });

  test('web view sends an unsuccessful connect result on an unsuccessful connection', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController
    );

    let messageRecieved;
    const fakeWebview = {
      html: '',
      postMessage: (message: any): void => {
        assert(!message.connectionSuccess);
        assert(message.connectionMessage.includes('Unable to load connection'));

        testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageRecieved = callback;
      }
    };

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController
    );

    testWebviewController.showConnectForm(
      mdbTestExtension.testExtensionContext
    );

    // Mock a connection call.
    messageRecieved({
      command: MESSAGE_TYPES.CONNECT,
      connectionModel: {
        port: 2700002, // Bad port number.
        hostname: 'localhost'
      }
    });
  });

  test('web view opens file picker on file picker request', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController
    );

    const fakeVSCodeOpenDialog = sinon.fake.resolves({
      path: './somefilepath/test.text'
    });

    let messageRecieved;
    const fakeWebview = {
      html: '',
      postMessage: (): void => {
        assert(fakeVSCodeOpenDialog.called);
        assert(fakeVSCodeOpenDialog.firstArg.canSelectFiles);

        testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageRecieved = callback;
      }
    };

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    sinon.replace(vscode.window, 'showOpenDialog', fakeVSCodeOpenDialog);

    const testWebviewController = new WebviewController(
      testConnectionController
    );

    testWebviewController.showConnectForm(
      mdbTestExtension.testExtensionContext
    );

    // Mock a connection call.
    messageRecieved({
      command: MESSAGE_TYPES.OPEN_FILE_PICKER,
      action: 'file_action'
    });
  });

  test('web view returns file name on file picker request', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController
    );

    let messageRecieved;
    const fakeWebview = {
      html: '',
      postMessage: (message: any): void => {
        assert(message.action === 'file_action');
        assert(message.files[0] === './somefilepath/test.text');

        testConnectionController.disconnect();
        done();
      },
      onDidReceiveMessage: (callback): void => {
        messageRecieved = callback;
      }
    };

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const fakeVSCodeOpenDialog = sinon.fake.resolves([
      {
        path: './somefilepath/test.text'
      }
    ]);
    sinon.replace(vscode.window, 'showOpenDialog', fakeVSCodeOpenDialog);

    const testWebviewController = new WebviewController(
      testConnectionController
    );

    testWebviewController.showConnectForm(
      mdbTestExtension.testExtensionContext
    );

    messageRecieved({
      command: MESSAGE_TYPES.OPEN_FILE_PICKER,
      action: 'file_action'
    });
  });

  test('web view runs the "connectWithURI" command when open connection string input is recieved', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(testExtensionContext),
      testStorageController
    );

    let messageRecieved;
    const fakeWebview = {
      html: '',
      onDidReceiveMessage: (callback): void => {
        messageRecieved = callback;
      }
    };

    const fakeVSCodeExecuteCommand = sinon.fake();
    sinon.replace(vscode.commands, 'executeCommand', fakeVSCodeExecuteCommand);

    const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
      webview: fakeWebview
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebviewPanel
    );

    const testWebviewController = new WebviewController(
      testConnectionController
    );

    testWebviewController.showConnectForm(
      mdbTestExtension.testExtensionContext
    );

    messageRecieved({
      command: MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT
    });

    setTimeout(() => {
      assert(fakeVSCodeExecuteCommand.called);
      assert(fakeVSCodeExecuteCommand.firstArg === 'mdb.connectWithURI');

      done();
    }, 50);
  });
});
