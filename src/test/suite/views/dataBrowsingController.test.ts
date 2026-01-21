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
      aggregate: sandbox.stub().resolves([{ count: 16 }]),
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
      expect(controller?.signal.aborted).to.be.false;
    });

    test('aborts previous AbortController when a new request starts', async function () {
      // Simulate a slow find request
      mockDataService.find = sandbox.stub().callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [{ _id: '1', name: 'test' }];
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
      expect(firstController?.signal.aborted).to.be.true;
      // Second controller should not be aborted
      expect(secondController?.signal.aborted).to.be.false;

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
      expect(controller?.signal.aborted).to.be.true;
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
      expect(controller1?.signal.aborted).to.be.true;
      expect(controller2?.signal.aborted).to.be.true;
      expect(testController._panelAbortControllers.size).to.equal(0);
    });
  });

  suite('Request handling with abort', function () {
    test('does not post message when request is aborted', async function () {
      // Abort the controller during the find request
      mockDataService.find = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers.get(mockPanel)?.abort();
        return [{ _id: '1', name: 'test' }];
      });
      mockDataService.aggregate = sandbox.stub().resolves([{ count: 16 }]);

      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      // postMessage should not be called because request was aborted
      expect(postMessageStub.called).to.be.false;
    });

    test('does not throw when error occurs on aborted request', async function () {
      // Abort the controller and throw an error during find
      mockDataService.find = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers.get(mockPanel)?.abort();
        throw new Error('Connection error');
      });
      mockDataService.aggregate = sandbox.stub().resolves([{ count: 16 }]);

      const options = createMockOptions();

      // Should not throw
      await testController.handleGetDocuments(mockPanel, options);

      // postMessage should not be called because request was aborted
      expect(postMessageStub.called).to.be.false;
    });
  });

  suite('Signal passed to data service', function () {
    test('passes signal to find call', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      expect(mockDataService.find.calledOnce).to.be.true;
      const executionOptions = mockDataService.find.firstCall.args[3];
      expect(executionOptions.abortSignal).to.be.instanceOf(AbortSignal);
    });
  });

  suite('Successful request handling', function () {
    test('posts loadDocuments message with documents on successful handleGetDocuments', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      expect(mockDataService.find.calledOnce).to.be.true;
      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.loadDocuments);
      expect(message.documents).to.deep.equal([{ _id: '1', name: 'test' }]);
    });

    test('sends updateTotalCount message after loadDocuments', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      // Wait for the async count to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockDataService.aggregate.calledOnce).to.be.true;
      // Second call should be updateTotalCount
      const countMessage = postMessageStub.secondCall?.args[0];
      expect(countMessage?.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(countMessage?.totalCount).to.equal(16);
    });

    test('returns totalCount of 0 when aggregate returns empty array', async function () {
      mockDataService.aggregate = sandbox.stub().resolves([]);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      // Wait for the async count to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      const countMessage = postMessageStub.secondCall?.args[0];
      expect(countMessage?.totalCount).to.equal(0);
    });

    test('does not call aggregate for view collections and sends null totalCount', async function () {
      const options = createMockOptions({
        collectionType: CollectionType.view,
      });

      await testController.handleGetDocuments(mockPanel, options);

      // Wait for the async count to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockDataService.aggregate.called).to.be.false;
      const countMessage = postMessageStub.secondCall?.args[0];
      expect(countMessage?.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(countMessage?.totalCount).to.equal(null);
    });

    test('does not call aggregate for timeseries collections and sends null totalCount', async function () {
      const options = createMockOptions({
        collectionType: CollectionType.timeseries,
      });

      await testController.handleGetDocuments(mockPanel, options);

      // Wait for the async count to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockDataService.aggregate.called).to.be.false;
      const countMessage = postMessageStub.secondCall?.args[0];
      expect(countMessage?.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(countMessage?.totalCount).to.equal(null);
    });
  });

  suite('Error handling in handleGetDocuments', function () {
    test('posts refreshError message on fetch failure', async function () {
      mockDataService.find = sandbox
        .stub()
        .rejects(new Error('Connection timeout'));
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.refreshError);
      expect(message.error).to.equal('Connection timeout');
    });

    test('posts updateTotalCountError message when aggregate fails', async function () {
      mockDataService.aggregate = sandbox
        .stub()
        .rejects(new Error('Aggregate failed'));
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      // Wait for the async count to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // First message should be loadDocuments (successful)
      const loadMessage = postMessageStub.firstCall.args[0];
      expect(loadMessage.command).to.equal(PreviewMessageType.loadDocuments);

      // Second message should be updateTotalCountError
      const errorMessage = postMessageStub.secondCall?.args[0];
      expect(errorMessage?.command).to.equal(PreviewMessageType.updateTotalCountError);
      expect(errorMessage?.error).to.equal('Aggregate failed');
    });
  });

  suite('Data service not available', function () {
    test('returns empty documents when no active data service', async function () {
      mockConnectionController.getActiveDataService = sandbox
        .stub()
        .returns(null);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.loadDocuments);
      expect(message.documents).to.deep.equal([]);
    });

    test('sends totalCount of 0 when no active data service', async function () {
      mockConnectionController.getActiveDataService = sandbox
        .stub()
        .returns(null);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options);

      // Wait for the async count to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      const countMessage = postMessageStub.secondCall?.args[0];
      expect(countMessage?.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(countMessage?.totalCount).to.equal(0);
    });

    test('returns empty documents for handleGetDocuments with pagination when no active data service', async function () {
      mockConnectionController.getActiveDataService = sandbox
        .stub()
        .returns(null);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.loadPage);
      expect(message.documents).to.deep.equal([]);
    });
  });

  suite('handleWebviewMessage', function () {
    test('calls handleGetDocuments when getDocuments message received with skip and limit', async function () {
      const options = createMockOptions();
      const handleGetDocumentsSpy = sandbox.spy(
        testController,
        'handleGetDocuments',
      );

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.getDocuments, skip: 0, limit: 10 },
        mockPanel,
        options,
      );

      expect(handleGetDocumentsSpy.calledOnce).to.be.true;
      expect(handleGetDocumentsSpy.calledWith(mockPanel, options, 0, 10)).to.be.true;
    });

    test('calls handleGetDocuments with pagination when getDocuments message received with skip and limit', async function () {
      const options = createMockOptions();
      const handleGetDocumentsSpy = sandbox.spy(
        testController,
        'handleGetDocuments',
      );

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.getDocuments, skip: 10, limit: 10 },
        mockPanel,
        options,
      );

      expect(handleGetDocumentsSpy.calledOnce).to.be.true;
      expect(handleGetDocumentsSpy.calledWith(mockPanel, options, 10, 10)).to.be
        .true;
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

  suite('handleGetDocuments with pagination', function () {
    test('posts loadPage message with documents on successful fetch', async function () {
      mockDataService.find = sandbox.stub().resolves([
        { _id: '11', name: 'doc11' },
        { _id: '12', name: 'doc12' },
      ]);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      expect(mockDataService.find.calledOnce).to.be.true;
      const findOptions = mockDataService.find.firstCall.args[2];
      expect(findOptions.skip).to.equal(10);
      expect(findOptions.limit).to.equal(10);
      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.loadPage);
      expect(message.documents).to.deep.equal([
        { _id: '11', name: 'doc11' },
        { _id: '12', name: 'doc12' },
      ]);
      expect(message.skip).to.equal(10);
      expect(message.limit).to.equal(10);
    });

    test('passes skip of 0 correctly', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 25);

      const findOptions = mockDataService.find.firstCall.args[2];
      expect(findOptions.limit).to.equal(25);
      // skip should not be set when 0
      expect(findOptions.skip).to.be.undefined;
    });

    test('posts refreshError message on fetch failure', async function () {
      mockDataService.find = sandbox
        .stub()
        .rejects(new Error('Connection failed'));
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.refreshError);
      expect(message.error).to.equal('Connection failed');
    });

    test('does not post message when request is aborted', async function () {
      mockDataService.find = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers.get(mockPanel)?.abort();
        return [{ _id: '1', name: 'test' }];
      });
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      expect(postMessageStub.called).to.be.false;
    });
  });

  suite('handleCancelRequest', function () {
    test('aborts the AbortController when cancel request is received', function () {
      // Create an abort controller for the panel
      (testController as any)._createAbortController(mockPanel);
      const controller = testController._panelAbortControllers.get(mockPanel);

      expect(controller?.signal.aborted).to.be.false;

      testController.handleCancelRequest(mockPanel);

      expect(controller?.signal.aborted).to.be.true;
    });

    test('removes the controller from _panelAbortControllers map', function () {
      // Create an abort controller for the panel
      (testController as any)._createAbortController(mockPanel);
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.true;

      testController.handleCancelRequest(mockPanel);

      expect(testController._panelAbortControllers.has(mockPanel)).to.be.false;
    });

    test('sends requestCancelled message to webview', function () {
      // Create an abort controller for the panel
      (testController as any)._createAbortController(mockPanel);

      testController.handleCancelRequest(mockPanel);

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.requestCancelled);
    });

    test('sends requestCancelled message even when no controller exists', function () {
      // No controller exists for this panel
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.false;

      testController.handleCancelRequest(mockPanel);

      // Should still send the cancelled message
      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.requestCancelled);
    });

    test('does not throw when no controller exists for the panel', function () {
      // No controller exists for this panel
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.false;

      // Should not throw
      expect(() =>
        testController.handleCancelRequest(mockPanel),
      ).to.not.throw();
    });
  });

  suite('handleWebviewMessage for cancelRequest', function () {
    test('calls handleCancelRequest when cancelRequest message received', async function () {
      const options = createMockOptions();
      const handleCancelRequestSpy = sandbox.spy(
        testController,
        'handleCancelRequest',
      );

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.cancelRequest },
        mockPanel,
        options,
      );

      expect(handleCancelRequestSpy.calledOnce).to.be.true;
      expect(handleCancelRequestSpy.calledWith(mockPanel)).to.be.true;
    });

    test('cancels in-flight request when cancelRequest message is received', async function () {
      // Simulate a slow find request
      let findResolve: (value: unknown) => void = () => {};
      mockDataService.find = sandbox.stub().callsFake(() => {
        return new Promise((resolve) => {
          findResolve = resolve;
        });
      });
      mockDataService.aggregate = sandbox.stub().resolves([{ count: 16 }]);

      const options = createMockOptions();

      // Start a request (don't await)
      const requestPromise = testController.handleGetDocuments(
        mockPanel,
        options,
      );
      const controller = testController._panelAbortControllers.get(mockPanel);

      expect(controller?.signal.aborted).to.be.false;

      // Send cancel request
      await testController.handleWebviewMessage(
        { command: PreviewMessageType.cancelRequest },
        mockPanel,
        options,
      );

      expect(controller?.signal.aborted).to.be.true;

      findResolve([]);
      await requestPromise;
    });
  });

});
