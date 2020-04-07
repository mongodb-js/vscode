import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';
const fs = require('fs');
const path = require('path');

import WebviewController, {
  getConnectWebviewContent,
  getReactAppUri
} from '../../../views/webviewController';

import { mdbTestExtension } from '../stubbableMdbExtension';

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
    assert(stubOnDidRecieveMessage.called);
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

    assert(
      htmlString.includes('vscode-resource:/out/connect-form/connectForm.js')
    );
    const connectFormFileName = (): string => 'out/connect-form/connectForm.js';
    const jsFileString = await readFile(
      path.resolve(__dirname, '..', '..', '..', '..', connectFormFileName())
    );
    assert(`${jsFileString}`.includes('ConnectionForm'));
  });

  // test('web view listens for a connect message and adds the connection', () => {
  //   const stubOnDidRecieveMessage = sinon.stub();
  //   const fakeWebview = {
  //     html: '',
  //     onDidReceiveMessage: stubOnDidRecieveMessage
  //   };

  //   const fakeVSCodeCreateWebviewPanel = sinon.fake.returns({
  //     webview: fakeWebview
  //   });
  //   sinon.replace(
  //     vscode.window,
  //     'createWebviewPanel',
  //     fakeVSCodeCreateWebviewPanel
  //   );

  //   const testWebviewController = new WebviewController(mdbTestExtension.testExtensionController._connectionController);

  //   const stubConnectMethod = sinon.stub();

  //   testWebviewController.showConnectForm(
  //     mdbTestExtension.testExtensionContext,
  //     () => Promise.resolve(true)
  //   );

  //   assert(fakeVSCodeCreateWebviewPanel.called);
  //   assert(fakeWebview.html !== '');
  //   assert(stubOnDidRecieveMessage.called);
  // });

  // To test: it recieves a connection model and connects to that connection.
  // It sends a connected response.
  // It opens a file viewer.
  // It sends the file view response.
});
