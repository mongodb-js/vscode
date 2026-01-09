import sinon, { type SinonSandbox, type SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { expect } from 'chai';
import { beforeEach, afterEach } from 'mocha';

import DataBrowsingController from '../../../views/dataBrowsingController';
import { PreviewMessageType } from '../../../views/data-browsing-app/extension-app-message-constants';
import type { DataBrowsingOptions } from '../../../views/dataBrowsingController';

suite('DataBrowsingController Test Suite', function () {
  const sandbox: SinonSandbox = sinon.createSandbox();
  let testController: DataBrowsingController;
  let mockPanel: vscode.WebviewPanel;
  let postMessageStub: SinonStub;

  function createMockPanel(): vscode.WebviewPanel {
    postMessageStub = sandbox.stub().resolves(true);
    return {
      webview: {
        html: '',
        postMessage: postMessageStub,
        onDidReceiveMessage: sandbox.stub(),
        asWebviewUri: sandbox.stub().returns(''),
      },
      onDidDispose: sandbox.stub(),
      dispose: sandbox.stub(),
    } as unknown as vscode.WebviewPanel;
  }

  function createMockOptions(
    overrides?: Partial<DataBrowsingOptions>,
  ): DataBrowsingOptions {
    return {
      namespace: 'test.collection',
      documents: [{ _id: '1', name: 'test' }],
      fetchDocuments: sandbox.stub().resolves([{ _id: '1', name: 'test' }]),
      getTotalCount: sandbox.stub().resolves(10),
      initialTotalCount: 10,
      ...overrides,
    };
  }

  beforeEach(() => {
    testController = new DataBrowsingController({
      connectionController: {} as any,
      telemetryService: {} as any,
    });
    mockPanel = createMockPanel();
  });

  afterEach(() => {
    testController.deactivate();
    sandbox.restore();
  });

  suite('AbortController management', function () {
    test('creates a new AbortController for each request', async function () {
      const options = createMockOptions();

      // First request
      await testController.handleGetDocuments(mockPanel, options);
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.true;

      const firstController =
        testController._panelAbortControllers.get(mockPanel);
      expect(firstController).to.not.be.undefined;
      expect(firstController!.signal.aborted).to.be.false;
    });

    test('aborts previous AbortController when a new request starts', async function () {
      const options = createMockOptions({
        fetchDocuments: sandbox.stub().callsFake(async () => {
          // Simulate a slow request
          await new Promise((resolve) => setTimeout(resolve, 50));
          return [{ _id: '1' }];
        }),
      });

      // Start first request (don't await)
      const firstRequest = testController.handleRefreshDocuments(
        mockPanel,
        options,
      );
      const firstController =
        testController._panelAbortControllers.get(mockPanel);

      // Start second request immediately (will abort the first)
      const secondRequest = testController.handleRefreshDocuments(
        mockPanel,
        options,
      );
      const secondController =
        testController._panelAbortControllers.get(mockPanel);

      // First controller should be aborted
      expect(firstController!.signal.aborted).to.be.true;
      // Second controller should not be aborted
      expect(secondController!.signal.aborted).to.be.false;

      await Promise.all([firstRequest, secondRequest]);
    });

    test('cleans up AbortController when panel closes', function () {
      // Create a controller for the panel
      (testController as any)._createAbortController(mockPanel);
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.true;

      const controller = testController._panelAbortControllers.get(mockPanel);

      // Simulate panel close
      testController.onWebviewPanelClosed(mockPanel);

      // Controller should be aborted and removed
      expect(controller!.signal.aborted).to.be.true;
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.false;
    });

    test('aborts all AbortControllers on deactivate', function () {
      const panel1 = createMockPanel();
      const panel2 = createMockPanel();

      // Create controllers for both panels
      (testController as any)._createAbortController(panel1);
      (testController as any)._createAbortController(panel2);

      const controller1 = testController._panelAbortControllers.get(panel1);
      const controller2 = testController._panelAbortControllers.get(panel2);

      // Deactivate
      testController.deactivate();

      // Both controllers should be aborted
      expect(controller1!.signal.aborted).to.be.true;
      expect(controller2!.signal.aborted).to.be.true;
      expect(testController._panelAbortControllers.size).to.equal(0);
    });
  });

  suite('Request handling with abort', function () {
    test('does not post message when request is aborted (handleGetDocuments)', async function () {
      const options = createMockOptions({
        getTotalCount: sandbox.stub().callsFake(async () => {
          // Abort the controller during the request
          testController._panelAbortControllers.get(mockPanel)?.abort();
          return 10;
        }),
      });

      await testController.handleGetDocuments(mockPanel, options);

      // postMessage should not be called because request was aborted
      expect(postMessageStub.called).to.be.false;
    });

    test('does not post message when request is aborted (handleRefreshDocuments)', async function () {
      const options = createMockOptions({
        fetchDocuments: sandbox.stub().callsFake(async () => {
          // Abort the controller during the request
          testController._panelAbortControllers.get(mockPanel)?.abort();
          return [{ _id: '1' }];
        }),
      });

      await testController.handleRefreshDocuments(mockPanel, options);

      // postMessage should not be called because request was aborted
      expect(postMessageStub.called).to.be.false;
    });

    test('does not post message when request is aborted (handleSortDocuments)', async function () {
      const options = createMockOptions({
        fetchDocuments: sandbox.stub().callsFake(async () => {
          // Abort the controller during the request
          testController._panelAbortControllers.get(mockPanel)?.abort();
          return [{ _id: '1' }];
        }),
      });

      await testController.handleSortDocuments(mockPanel, options, 'asc');

      // postMessage should not be called because request was aborted
      expect(postMessageStub.called).to.be.false;
    });

    test('does not post error message when error occurs on aborted request', async function () {
      const options = createMockOptions({
        fetchDocuments: sandbox.stub().callsFake(async ({ signal }) => {
          // Abort the controller and throw an error
          testController._panelAbortControllers.get(mockPanel)?.abort();
          throw new Error('Connection error');
        }),
      });

      await testController.handleRefreshDocuments(mockPanel, options);

      // postMessage should not be called with error because request was aborted
      expect(postMessageStub.called).to.be.false;
    });
  });

  suite('Signal passed to callbacks', function () {
    test('passes signal to fetchDocuments callback', async function () {
      const fetchDocumentsStub = sandbox.stub().resolves([{ _id: '1' }]);
      const options = createMockOptions({
        fetchDocuments: fetchDocumentsStub,
        getTotalCount: undefined,
        initialTotalCount: 5,
      });

      await testController.handleRefreshDocuments(mockPanel, options);

      expect(fetchDocumentsStub.calledOnce).to.be.true;
      const callArgs = fetchDocumentsStub.firstCall.args[0];
      expect(callArgs).to.have.property('signal');
      expect(callArgs.signal).to.be.instanceOf(AbortSignal);
    });

    test('passes signal to getTotalCount callback', async function () {
      const getTotalCountStub = sandbox.stub().resolves(10);
      const options = createMockOptions({
        getTotalCount: getTotalCountStub,
      });

      await testController.handleGetDocuments(mockPanel, options);

      expect(getTotalCountStub.calledOnce).to.be.true;
      const signal = getTotalCountStub.firstCall.args[0];
      expect(signal).to.be.instanceOf(AbortSignal);
    });

    test('passes sort option along with signal to fetchDocuments', async function () {
      const fetchDocumentsStub = sandbox.stub().resolves([{ _id: '1' }]);
      const options = createMockOptions({
        fetchDocuments: fetchDocumentsStub,
        getTotalCount: undefined,
        initialTotalCount: 5,
      });

      await testController.handleSortDocuments(mockPanel, options, 'desc');

      expect(fetchDocumentsStub.calledOnce).to.be.true;
      const callArgs = fetchDocumentsStub.firstCall.args[0];
      expect(callArgs).to.have.property('sort');
      expect(callArgs.sort).to.equal('desc');
      expect(callArgs).to.have.property('signal');
      expect(callArgs.signal).to.be.instanceOf(AbortSignal);
    });
  });

  suite('Successful request handling', function () {
    test('posts loadDocuments message on successful handleGetDocuments', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.loadDocuments);
      expect(message.documents).to.deep.equal(options.documents);
      expect(message.totalCount).to.equal(10);
    });

    test('posts loadDocuments message on successful handleRefreshDocuments', async function () {
      const options = createMockOptions();

      await testController.handleRefreshDocuments(mockPanel, options);

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.loadDocuments);
    });

    test('posts refreshError message when fetchDocuments throws (non-aborted)', async function () {
      const options = createMockOptions({
        fetchDocuments: sandbox.stub().rejects(new Error('Database error')),
      });

      await testController.handleRefreshDocuments(mockPanel, options);

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.error).to.include('Database error');
    });
  });
});
