import sinon from 'sinon';
import * as vscode from 'vscode';
import { expect } from 'chai';
import { beforeEach, afterEach } from 'mocha';

import ConnectionController from '../../../connectionController';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { PreviewMessageType } from '../../../views/data-browsing-app/extension-app-message-constants';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TelemetryService } from '../../../telemetry';
import { ExtensionContextStub } from '../stubs';
import DataBrowsingController, {
  getDataBrowsingContent,
} from '../../../views/dataBrowsingController';

suite('DataBrowsingController Test Suite', function () {
  const sandbox = sinon.createSandbox();
  let extensionContextStub: ExtensionContextStub;
  let testStorageController: StorageController;
  let testTelemetryService: TelemetryService;
  let testConnectionController: ConnectionController;
  let testDataBrowsingController: DataBrowsingController;

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
    testDataBrowsingController = new DataBrowsingController({
      connectionController: testConnectionController,
      telemetryService: testTelemetryService,
    });
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

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      {
        namespace: 'test.collection',
        documents: [{ _id: '1', name: 'test' }],
      },
    );

    expect(fakeVSCodeCreateWebviewPanel).to.be.calledOnce;
    expect(fakeWebview.html).to.not.equal('');
    expect(stubOnDidReceiveMessage).to.be.calledOnce;
  });

  test('web view content is rendered with the dataBrowsingApp.js script', function () {
    const extensionPath = mdbTestExtension.extensionContextStub.extensionPath;
    const htmlString = getDataBrowsingContent({
      extensionPath,
      webview: {
        asWebviewUri: (jsUri) => {
          return jsUri;
        },
      } as unknown as vscode.Webview,
    });

    expect(htmlString).to.include('dist/dataBrowsingApp.js');
    expect(htmlString).to.include('MongoDB Data Browser');
  });

  test('panel title includes the namespace', function () {
    const fakeWebview = {
      html: '',
      onDidReceiveMessage: sandbox.stub(),
      asWebviewUri: sandbox.stub().returns(''),
    } as unknown as vscode.Webview;
    const fakeVSCodeCreateWebviewPanel = sandbox
      .stub(vscode.window, 'createWebviewPanel')
      .returns({
        webview: fakeWebview,
        onDidDispose: sandbox.stub().returns(''),
      } as unknown as vscode.WebviewPanel);

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      {
        namespace: 'mydb.users',
        documents: [],
      },
    );

    expect(fakeVSCodeCreateWebviewPanel).to.be.calledOnce;
    expect(fakeVSCodeCreateWebviewPanel.firstCall.args[1]).to.equal(
      'Preview: mydb.users',
    );
  });

  test('handles GET_DOCUMENTS message and sends documents to webview', function (done) {
    let messageReceived;
    const mockDocuments = [{ _id: '1' }, { _id: '2' }];

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (message): void => {
          expect(message.command).to.equal(PreviewMessageType.loadDocuments);
          expect(message.documents).to.deep.equal(mockDocuments);
          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.stub().returns(''),
      },
      onDidDispose: sandbox.stub().returns(''),
    } as unknown as vscode.WebviewPanel);

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      {
        namespace: 'test.collection',
        documents: mockDocuments,
      },
    );

    messageReceived({
      command: PreviewMessageType.getDocuments,
    });
  });

  test('handles REFRESH_DOCUMENTS message and fetches new documents', function (done) {
    let messageReceived;
    const initialDocuments = [{ _id: '1' }];
    const refreshedDocuments = [{ _id: '1' }, { _id: '2' }, { _id: '3' }];
    const fetchDocuments = sandbox.stub().resolves(refreshedDocuments);

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (message): void => {
          expect(message.command).to.equal(PreviewMessageType.loadDocuments);
          expect(message.documents).to.deep.equal(refreshedDocuments);
          expect(fetchDocuments).to.be.calledOnce;
          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.stub().returns(''),
      },
      onDidDispose: sandbox.stub().returns(''),
    } as unknown as vscode.WebviewPanel);

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      {
        namespace: 'test.collection',
        documents: initialDocuments,
        fetchDocuments,
      },
    );

    messageReceived({
      command: PreviewMessageType.refreshDocuments,
    });
  });

  test('handles SORT_DOCUMENTS message with sort option', function (done) {
    let messageReceived;
    const sortedDocuments = [{ _id: '3' }, { _id: '2' }, { _id: '1' }];
    const fetchDocuments = sandbox.stub().resolves(sortedDocuments);

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (message): void => {
          expect(message.command).to.equal(PreviewMessageType.loadDocuments);
          expect(message.documents).to.deep.equal(sortedDocuments);
          expect(fetchDocuments).to.be.calledOnceWith({ sort: 'desc' });
          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.stub().returns(''),
      },
      onDidDispose: sandbox.stub().returns(''),
    } as unknown as vscode.WebviewPanel);

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      {
        namespace: 'test.collection',
        documents: [],
        fetchDocuments,
      },
    );

    messageReceived({
      command: PreviewMessageType.sortDocuments,
      sort: 'desc',
    });
  });

  test('includes totalCount in response when getTotalCount is provided', function (done) {
    let messageReceived;
    const mockDocuments = [{ _id: '1' }];
    const getTotalCount = sandbox.stub().resolves(100);

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (message): void => {
          expect(message.command).to.equal(PreviewMessageType.loadDocuments);
          expect(message.totalCount).to.equal(100);
          expect(getTotalCount).to.be.calledOnce;
          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.stub().returns(''),
      },
      onDidDispose: sandbox.stub().returns(''),
    } as unknown as vscode.WebviewPanel);

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      {
        namespace: 'test.collection',
        documents: mockDocuments,
        getTotalCount,
      },
    );

    messageReceived({
      command: PreviewMessageType.getDocuments,
    });
  });

  test('notifies all webviews when theme changes', function (done) {
    const totalExpectedPostMessageCalls = 2;
    let callsSoFar = 0;

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (message): void => {
          expect(message.command).to.equal(PreviewMessageType.themeChanged);
          expect(message.darkMode).to.be.true;
          if (++callsSoFar === totalExpectedPostMessageCalls) {
            done();
          }
        },
        onDidReceiveMessage: (): void => {},
        asWebviewUri: sandbox.stub().returns(''),
      },
      onDidDispose: sandbox.stub().returns(''),
    } as unknown as vscode.WebviewPanel);

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      { namespace: 'test.col1', documents: [] },
    );

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      { namespace: 'test.col2', documents: [] },
    );

    // Mock a theme change
    void testDataBrowsingController.onThemeChanged({
      kind: vscode.ColorThemeKind.Dark,
    });
  });

  test('removes panel from active panels when disposed', function () {
    const onDisposeCallback: (() => void)[] = [];

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: sandbox.stub(),
        onDidReceiveMessage: sandbox.stub(),
        asWebviewUri: sandbox.stub().returns(''),
      },
      onDidDispose: (callback): void => {
        onDisposeCallback.push(callback);
      },
    } as unknown as vscode.WebviewPanel);

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      { namespace: 'test.col1', documents: [] },
    );

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      { namespace: 'test.col2', documents: [] },
    );

    expect(testDataBrowsingController._activeWebviewPanels.length).to.equal(2);

    // Simulate first panel being disposed
    onDisposeCallback[0]();

    expect(testDataBrowsingController._activeWebviewPanels.length).to.equal(1);
  });

  test('sends error message when fetchDocuments fails', function (done) {
    let messageReceived;
    const fetchDocuments = sandbox
      .stub()
      .rejects(new Error('Connection failed'));

    sandbox.stub(vscode.window, 'createWebviewPanel').returns({
      webview: {
        html: '',
        postMessage: (message): void => {
          expect(message.command).to.equal(PreviewMessageType.refreshError);
          expect(message.error).to.include('Connection failed');
          done();
        },
        onDidReceiveMessage: (callback): void => {
          messageReceived = callback;
        },
        asWebviewUri: sandbox.stub().returns(''),
      },
      onDidDispose: sandbox.stub().returns(''),
    } as unknown as vscode.WebviewPanel);

    void testDataBrowsingController.openDataBrowser(
      mdbTestExtension.extensionContextStub,
      {
        namespace: 'test.collection',
        documents: [],
        fetchDocuments,
      },
    );

    messageReceived({
      command: PreviewMessageType.refreshDocuments,
    });
  });
});

