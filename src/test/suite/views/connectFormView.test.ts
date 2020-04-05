import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';
const fs = require('fs');
const path = require('path');

import ConnectFormView, {
  getConnectWebviewContent,
  getReactAppUri
} from '../../../views/connectFormView';

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

    const fakeVSCodeCreateWebViewPanel = sinon.fake.returns({
      webview: fakeWebview
    });
    sinon.replace(
      vscode.window,
      'createWebviewPanel',
      fakeVSCodeCreateWebViewPanel
    );

    const testConnectFormView = new ConnectFormView();

    testConnectFormView.showConnectForm(
      mdbTestExtension.testExtensionContext,
      () => Promise.resolve(true)
    );

    assert(fakeVSCodeCreateWebViewPanel.called);
    assert(fakeWebview.html !== '');
    assert(stubOnDidRecieveMessage.called);
  });

  test('web view content is rendered with the js form', async () => {
    async function readFile(filePath): Promise<string> {
      return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', function(err, data) {
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
});
