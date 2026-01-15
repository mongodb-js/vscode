import sinon, { type SinonSandbox, type SinonStub } from 'sinon';
import type * as vscode from 'vscode';
import { expect } from 'chai';
import { beforeEach, afterEach } from 'mocha';

import DataBrowsingController from '../../../views/dataBrowsingController';
import { PreviewMessageType } from '../../../views/data-browsing-app/extension-app-message-constants';
import type { DataBrowsingOptions } from '../../../views/dataBrowsingController';
import { CollectionType } from '../../../explorer/documentUtils';

suite('DataBrowsingController Test Suite', function () {
  const sandbox: SinonSandbox = sinon.createSandbox();
  let testController: DataBrowsingController;
  let mockPanel: vscode.WebviewPanel;
  let postMessageStub: SinonStub;
  let mockDataService: {
    find: SinonStub;
    aggregate: SinonStub;
  };
  let mockConnectionController: {
    getActiveDataService: SinonStub;
  };

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
      collectionType: CollectionType.collection,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockDataService = {
      find: sandbox.stub().resolves([{ _id: '1', name: 'test' }]),
      aggregate: sandbox.stub().resolves([{ count: 10 }]),
    };
    mockConnectionController = {
      getActiveDataService: sandbox.stub().returns(mockDataService),
    };
    testController = new DataBrowsingController({
      connectionController: mockConnectionController as any,
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

      await testController.handleGetDocuments(mockPanel, options);
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.true;

      const controller = testController._panelAbortControllers.get(mockPanel);
      expect(controller).to.not.be.undefined;
      expect(controller!.signal.aborted).to.be.false;
    });

    test('aborts previous AbortController when a new request starts', async function () {
      // Simulate a slow aggregate request
      mockDataService.aggregate = sandbox.stub().callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [{ count: 10 }];
      });

      const options = createMockOptions();

      // Start first request (don't await)
      const firstRequest = testController.handleGetDocuments(
        mockPanel,
        options,
      );
      const firstController =
        testController._panelAbortControllers.get(mockPanel);

      // Start second request immediately (will abort the first)
      const secondRequest = testController.handleGetDocuments(
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
    test('does not post message when request is aborted', async function () {
      // Abort the controller during the aggregate request
      mockDataService.aggregate = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers.get(mockPanel)?.abort();
        return [{ count: 10 }];
      });

      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      // postMessage should not be called because request was aborted
      expect(postMessageStub.called).to.be.false;
    });

    test('does not throw when error occurs on aborted request', async function () {
      // Abort the controller and throw an error during aggregate
      mockDataService.aggregate = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers.get(mockPanel)?.abort();
        throw new Error('Connection error');
      });

      const options = createMockOptions();

      // Should not throw
      await testController.handleGetDocuments(mockPanel, options);

      // postMessage should not be called because request was aborted
      expect(postMessageStub.called).to.be.false;
    });
  });

  suite('Signal passed to data service', function () {
    test('passes signal to aggregate call', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      expect(mockDataService.aggregate.calledOnce).to.be.true;
      const executionOptions = mockDataService.aggregate.firstCall.args[3];
      expect(executionOptions.abortSignal).to.be.instanceOf(AbortSignal);
    });

    test('passes signal to find call', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      expect(mockDataService.find.calledOnce).to.be.true;
      const executionOptions = mockDataService.find.firstCall.args[3];
      expect(executionOptions.abortSignal).to.be.instanceOf(AbortSignal);
    });
  });

  suite('Successful request handling', function () {
    test('posts loadDocuments message on successful handleGetDocuments', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      expect(mockDataService.find.calledOnce).to.be.true;
      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.loadDocuments);
      expect(message.documents).to.deep.equal([{ _id: '1', name: 'test' }]);
      expect(message.totalCount).to.equal(10);
    });
  });

  suite('handleWebviewMessage', function () {
    test('calls handleGetDocuments when getDocuments message received', async function () {
      const options = createMockOptions();
      const handleGetDocumentsSpy = sandbox.spy(
        testController,
        'handleGetDocuments',
      );

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.getDocuments },
        mockPanel,
        options,
      );

      expect(handleGetDocumentsSpy.calledOnce).to.be.true;
      expect(handleGetDocumentsSpy.calledWith(mockPanel, options)).to.be.true;
    });

    test('does nothing for unknown message commands', async function () {
      const options = createMockOptions();

      // Should not throw
      await testController.handleWebviewMessage(
        { command: 'UNKNOWN_COMMAND' } as any,
        mockPanel,
        options,
      );

      expect(postMessageStub.called).to.be.false;
    });
  });
});
