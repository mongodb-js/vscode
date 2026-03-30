import sinon, { type SinonSandbox, type SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { expect } from 'chai';
import { beforeEach, afterEach } from 'mocha';
import * as bson from 'bson';

import DataBrowsingController, {
  parseConstructionOptions,
  parseConstructionOptionsForFind,
  parseConstructionOptionsForAggregate,
} from '../../../views/dataBrowsingController';
import { PreviewMessageType } from '../../../views/data-browsing-app/extension-app-message-constants';
import type { DataBrowsingOptions } from '../../../views/dataBrowsingController';
import { CollectionType } from '../../../explorer/documentUtils';
import { EJSON } from 'bson';
import ExtensionCommand from '../../../commands';
import { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';
import {
  DataBrowserDocumentsFetchedTelemetryEvent,
  DataBrowserDocumentEditedTelemetryEvent,
  DataBrowserDocumentClonedTelemetryEvent,
  DataBrowserDocumentInsertedTelemetryEvent,
} from '../../../telemetry';

suite('DataBrowsingController Test Suite', function () {
  const sandbox: SinonSandbox = sinon.createSandbox();
  let testController: DataBrowsingController;
  let mockPanel: vscode.WebviewPanel;
  let postMessageStub: SinonStub;
  let mockDataService: {
    aggregate: SinonStub;
  };
  let mockConnectionController: {
    getActiveDataService: SinonStub;
    getMongoClientConnectionOptions: SinonStub;
    getActiveConnectionId: SinonStub;
  };
  let mockServiceProvider: {
    find: SinonStub;
    aggregate: SinonStub;
    close: SinonStub;
    get bsonLibrary(): typeof bson;
  };
  let mockCursor: {
    toArray: SinonStub;
  };
  let mockExplorerController: {
    refresh: SinonStub;
    refreshCollection: SinonStub;
  };
  let trackStub: SinonStub;

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
      databaseName: 'test',
      collectionName: 'collection',
      collectionType: CollectionType.collection,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockCursor = {
      toArray: sandbox.stub().resolves([{ _id: '1', name: 'test' }]),
    };
    mockServiceProvider = {
      find: sandbox.stub().returns(mockCursor),
      aggregate: sandbox.stub().returns(mockCursor),
      close: sandbox.stub().resolves(),
      get bsonLibrary() {
        return bson;
      },
    };
    sandbox
      .stub(NodeDriverServiceProvider, 'connect')
      .resolves(mockServiceProvider as any);
    mockDataService = {
      aggregate: sandbox.stub().resolves([{ count: 16 }]),
    };
    mockConnectionController = {
      getActiveDataService: sandbox.stub().returns(mockDataService),
      getMongoClientConnectionOptions: sandbox
        .stub()
        .returns({ url: 'mongodb://localhost:27017', options: {} }),
      getActiveConnectionId: sandbox.stub().returns('test-connection-id'),
    };
    mockExplorerController = {
      refresh: sandbox.stub().returns(true),
      refreshCollection: sandbox.stub().returns(true),
    };
    trackStub = sandbox.stub();
    testController = new DataBrowsingController({
      connectionController: mockConnectionController as any,
      telemetryService: { track: trackStub } as any,
    });
    mockPanel = createMockPanel();
    // Register the panel as belonging to the current active connection
    // so that handleWebviewMessage connection validation passes.
    testController._panelConnectionIds.set(mockPanel, 'test-connection-id');
  });

  afterEach(() => {
    testController.deactivate();
    sandbox.restore();
  });

  // Helper to find a postMessage call by command type
  function findMessageByCommand(
    stub: SinonStub,
    command: string,
  ): unknown | undefined {
    const calls = stub.getCalls();
    for (const call of calls) {
      if (call.args[0]?.command === command) {
        return call.args[0];
      }
    }
    return undefined;
  }

  suite('AbortController management', function () {
    test('creates a new AbortController for each request type', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.true;

      const controllers = testController._panelAbortControllers.get(mockPanel);
      expect(controllers).to.not.be.undefined;
      expect(controllers?.documents?.signal.aborted).to.be.false;
    });

    test('aborts previous AbortController when a new request of the same type starts', async function () {
      // Simulate a slow find request
      mockCursor.toArray = sandbox.stub().callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [{ _id: '1', name: 'test' }];
      });

      const options = createMockOptions();

      // Start first request (don't await)
      const firstRequest = testController.handleGetDocuments(
        mockPanel,
        options,
        0,
        10,
      );
      const firstController =
        testController._panelAbortControllers.get(mockPanel)?.documents;

      // Start second request immediately (will abort the first)
      const secondRequest = testController.handleGetDocuments(
        mockPanel,
        options,
        0,
        10,
      );
      const secondController =
        testController._panelAbortControllers.get(mockPanel)?.documents;

      // First controller should be aborted
      expect(firstController?.signal.aborted).to.be.true;
      // Second controller should not be aborted
      expect(secondController?.signal.aborted).to.be.false;

      await Promise.all([firstRequest, secondRequest]);
    });

    test('does not abort documents controller when totalCount request starts', async function () {
      // Simulate slow requests
      mockCursor.toArray = sandbox.stub().callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [{ _id: '1', name: 'test' }];
      });
      mockDataService.aggregate = sandbox.stub().callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [{ count: 100 }];
      });

      const options = createMockOptions();

      // Start documents request (don't await)
      const documentsRequest = testController.handleGetDocuments(
        mockPanel,
        options,
        0,
        10,
      );
      const documentsController =
        testController._panelAbortControllers.get(mockPanel)?.documents;

      // Start totalCount request (should NOT abort documents)
      const countRequest = testController.handleGetTotalCount(
        mockPanel,
        options,
      );
      const countController =
        testController._panelAbortControllers.get(mockPanel)?.totalCount;

      // Documents controller should NOT be aborted
      expect(documentsController?.signal.aborted).to.be.false;
      // Count controller should not be aborted either
      expect(countController?.signal.aborted).to.be.false;

      await Promise.all([documentsRequest, countRequest]);
    });

    test('cleans up all AbortControllers when panel closes', async function () {
      const options = createMockOptions();

      // Simulate slow requests
      mockCursor.toArray = sandbox.stub().callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [{ _id: '1', name: 'test' }];
      });
      mockDataService.aggregate = sandbox.stub().callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [{ count: 100 }];
      });

      // Start both requests
      const documentsRequest = testController.handleGetDocuments(
        mockPanel,
        options,
        0,
        10,
      );
      const countRequest = testController.handleGetTotalCount(
        mockPanel,
        options,
      );

      const controllers = testController._panelAbortControllers.get(mockPanel);
      const documentsController = controllers?.documents;
      const countController = controllers?.totalCount;

      // Simulate panel close
      testController.onWebviewPanelClosed(mockPanel, options);

      // Both controllers should be aborted and removed
      expect(documentsController?.signal.aborted).to.be.true;
      expect(countController?.signal.aborted).to.be.true;
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.false;

      await Promise.all([documentsRequest, countRequest]);
    });

    test('aborts all AbortControllers on deactivate', async function () {
      const panel1 = createMockPanel();
      const panel2 = createMockPanel();
      const options = createMockOptions();

      // Simulate slow requests
      mockCursor.toArray = sandbox.stub().callsFake(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [{ _id: '1', name: 'test' }];
      });

      // Create controllers for both panels
      const request1 = testController.handleGetDocuments(
        panel1,
        options,
        0,
        10,
      );
      const request2 = testController.handleGetDocuments(
        panel2,
        options,
        0,
        10,
      );

      const controller1 =
        testController._panelAbortControllers.get(panel1)?.documents;
      const controller2 =
        testController._panelAbortControllers.get(panel2)?.documents;

      // Deactivate
      testController.deactivate();

      // Both controllers should be aborted
      expect(controller1?.signal.aborted).to.be.true;
      expect(controller2?.signal.aborted).to.be.true;
      expect(testController._panelAbortControllers.size).to.equal(0);

      await Promise.all([request1, request2]);
    });
  });

  suite('Request handling with abort', function () {
    test('does not post message when request is aborted', async function () {
      // Abort the controller during the find request
      mockCursor.toArray = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers
          .get(mockPanel)
          ?.documents?.abort();
        return [{ _id: '1', name: 'test' }];
      });

      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      // No messages should be posted
      expect(postMessageStub.callCount).to.equal(0);
    });

    test('does not throw when error occurs on aborted request', async function () {
      // Abort the controller and throw an error during find
      mockCursor.toArray = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers
          .get(mockPanel)
          ?.documents?.abort();
        throw new Error('Connection error');
      });

      const options = createMockOptions();

      // Should not throw
      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      // No messages should be posted
      expect(postMessageStub.callCount).to.equal(0);
    });
  });

  suite('Signal passed to data service', function () {
    test('passes signal to find call', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      expect(mockServiceProvider.find.calledOnce).to.be.true;
      const dbOptions = mockServiceProvider.find.firstCall.args[4];
      expect(dbOptions.abortSignal).to.be.instanceOf(AbortSignal);
    });
  });

  suite('Successful request handling', function () {
    test('posts loadPage message with documents on initial handleGetDocuments', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      expect(mockServiceProvider.find.calledOnce).to.be.true;
      expect(postMessageStub.callCount).to.equal(1);
      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.loadPage,
      ) as { command: string; documents: unknown[] };
      expect(message).to.not.be.undefined;
      expect(message.documents).to.deep.equal([{ _id: '1', name: 'test' }]);
      expect(trackStub.calledOnce).to.be.true;
      expect(trackStub.firstCall.args[0]).to.be.instanceOf(
        DataBrowserDocumentsFetchedTelemetryEvent,
      );
      expect(trackStub.firstCall.args[0].properties.source).to.equal(
        'collection',
      );
    });

    test('posts loadPage message with documents on pagination', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      expect(postMessageStub.callCount).to.equal(1);
      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.loadPage,
      );
      expect(message).to.not.be.undefined;
    });

    test('does not call aggregate in handleGetDocuments', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      expect(mockDataService.aggregate.called).to.be.false;
    });
  });

  suite('Error handling in handleGetDocuments', function () {
    test('posts getDocumentError message on fetch failure', async function () {
      mockCursor.toArray = sandbox
        .stub()
        .rejects(new Error('Connection timeout'));
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      expect(postMessageStub.callCount).to.equal(1);
      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.getDocumentError,
      ) as { command: string; error: string };
      expect(message).to.not.be.undefined;
      expect(message.error).to.equal('Connection timeout');
    });
  });

  suite('Data service not available', function () {
    test('posts error message when no connection options', async function () {
      mockConnectionController.getMongoClientConnectionOptions = sandbox
        .stub()
        .returns(null);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.getDocumentError,
      ) as { command: string; error: string };
      expect(message).to.not.be.undefined;
      expect(message.error).to.equal('No connection options found');
    });

    test('posts error message for handleGetDocuments with pagination when no connection options', async function () {
      mockConnectionController.getMongoClientConnectionOptions = sandbox
        .stub()
        .returns(null);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.getDocumentError,
      ) as { command: string; error: string };
      expect(message).to.not.be.undefined;
      expect(message.error).to.equal('No connection options found');
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
      expect(handleGetDocumentsSpy.calledWith(mockPanel, options, 0, 10)).to.be
        .true;
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

    test('calls handleGetDocuments with sort when getDocuments message includes sort', async function () {
      const options = createMockOptions();
      const handleGetDocumentsSpy = sandbox.spy(
        testController,
        'handleGetDocuments',
      );

      await testController.handleWebviewMessage(
        {
          command: PreviewMessageType.getDocuments,
          skip: 0,
          limit: 10,
          sort: { _id: -1 },
        },
        mockPanel,
        options,
      );

      expect(handleGetDocumentsSpy.calledOnce).to.be.true;
      expect(
        handleGetDocumentsSpy.calledWith(mockPanel, options, 0, 10, {
          _id: -1,
        }),
      ).to.be.true;
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

  suite('handleWebviewMessage connection mismatch (VSCODE-770)', function () {
    function switchConnection(): void {
      // Simulate switching to a different connection.
      mockConnectionController.getActiveConnectionId.returns(
        'different-connection-id',
      );
    }

    test('sends getDocumentError when connection changed and getDocuments requested', async function () {
      switchConnection();
      const options = createMockOptions();

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.getDocuments, skip: 0, limit: 10 },
        mockPanel,
        options,
      );

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.getDocumentError);
      expect(message.error).to.include('no longer active');
    });

    test('sends updateTotalCountError when connection changed and getTotalCount requested', async function () {
      switchConnection();
      const options = createMockOptions();

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.getTotalCount },
        mockPanel,
        options,
      );

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(
        PreviewMessageType.updateTotalCountError,
      );
      expect(message.error).to.include('no longer active');
    });

    test('does not post any message when connection changed and cancelRequest received', async function () {
      switchConnection();
      const options = createMockOptions();

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.cancelRequest },
        mockPanel,
        options,
      );

      expect(postMessageStub.called).to.be.false;
    });

    test('shows vscode error when connection changed and editDocument requested', async function () {
      switchConnection();
      const options = createMockOptions();
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves();

      await testController.handleWebviewMessage(
        {
          command: PreviewMessageType.editDocument,
          documentId: { $oid: '123' },
        },
        mockPanel,
        options,
      );

      expect(postMessageStub.called).to.be.false;
      expect(showErrorStub.calledOnce).to.be.true;
      expect(showErrorStub.firstCall.args[0]).to.include('no longer active');
    });

    test('shows vscode error when connection changed and insertDocument requested', async function () {
      switchConnection();
      const options = createMockOptions();
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves();

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.insertDocument },
        mockPanel,
        options,
      );

      expect(postMessageStub.called).to.be.false;
      expect(showErrorStub.calledOnce).to.be.true;
      expect(showErrorStub.firstCall.args[0]).to.include('no longer active');
    });

    test('still sends theme colors even when connection changed', async function () {
      switchConnection();
      const options = createMockOptions();

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.getThemeColors },
        mockPanel,
        options,
      );

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.updateThemeColors);
    });

    test('does not fetch documents when connection changed', async function () {
      switchConnection();
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

      expect(handleGetDocumentsSpy.called).to.be.false;
    });

    test('allows requests when panel connection matches active connection', async function () {
      // Don't switch — connection still matches.
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
    });
  });

  suite('handleGetDocuments with pagination', function () {
    test('posts loadPage message with documents on pagination', async function () {
      mockCursor.toArray = sandbox.stub().resolves([
        { _id: '11', name: 'doc11' },
        { _id: '12', name: 'doc12' },
      ]);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      expect(mockServiceProvider.find.calledOnce).to.be.true;
      const findOptions = mockServiceProvider.find.firstCall.args[3];
      expect(findOptions.skip).to.equal(10);
      expect(findOptions.limit).to.equal(10);
      expect(postMessageStub.callCount).to.equal(1);
      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.loadPage,
      ) as { command: string; documents: unknown[] };
      expect(message).to.not.be.undefined;
      expect(message.documents).to.deep.equal([
        { _id: '11', name: 'doc11' },
        { _id: '12', name: 'doc12' },
      ]);
    });

    test('passes skip of 0 correctly', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 25);

      const findOptions = mockServiceProvider.find.firstCall.args[3];
      expect(findOptions.limit).to.equal(25);
      // skip should not be set when 0
      expect(findOptions.skip).to.be.undefined;
    });

    test('passes sort to find call when sort is provided', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10, {
        _id: -1,
      });

      expect(mockServiceProvider.find.calledOnce).to.be.true;
      const findOptions = mockServiceProvider.find.firstCall.args[3];
      expect(findOptions.sort).to.deep.equal({ _id: -1 });
    });

    test('does not include sort in find options when sort is not provided', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      expect(mockServiceProvider.find.calledOnce).to.be.true;
      const findOptions = mockServiceProvider.find.firstCall.args[3];
      expect(findOptions.sort).to.be.undefined;
    });

    test('posts getDocumentError message on fetch failure', async function () {
      mockCursor.toArray = sandbox
        .stub()
        .rejects(new Error('Connection failed'));
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      expect(postMessageStub.callCount).to.equal(1);
      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.getDocumentError,
      ) as { command: string; error: string };
      expect(message).to.not.be.undefined;
      expect(message.error).to.equal('Connection failed');
    });

    test('does not post message when request is aborted', async function () {
      mockCursor.toArray = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers
          .get(mockPanel)
          ?.documents?.abort();
        return [{ _id: '1', name: 'test' }];
      });
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      // No messages should be posted
      expect(postMessageStub.callCount).to.equal(0);
    });
  });

  suite('handleCancelRequest', function () {
    test('aborts the AbortController when cancel request is received', function () {
      // Create an abort controller for the panel
      (testController as any)._createAbortController(mockPanel, 'documents');
      const controller = testController._panelAbortControllers.get(mockPanel);

      expect(controller?.documents?.signal.aborted).to.be.false;

      testController.handleCancelRequest(mockPanel);

      expect(controller?.documents?.signal.aborted).to.be.true;
    });

    test('removes the controller from _panelAbortControllers map', function () {
      // Create an abort controller for the panel
      (testController as any)._createAbortController(mockPanel, 'documents');
      expect(testController._panelAbortControllers.has(mockPanel)).to.be.true;

      testController.handleCancelRequest(mockPanel);

      expect(testController._panelAbortControllers.has(mockPanel)).to.be.false;
    });

    test('sends requestCancelled message to webview', function () {
      // Create an abort controller for the panel
      (testController as any)._createAbortController(mockPanel, 'documents');

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
      mockCursor.toArray = sandbox.stub().callsFake(() => {
        return new Promise((resolve) => {
          findResolve = resolve;
        });
      });

      const options = createMockOptions();

      // Start a request (don't await)
      const requestPromise = testController.handleGetDocuments(
        mockPanel,
        options,
        0,
        10,
      );
      const controller = testController._panelAbortControllers.get(mockPanel);

      expect(controller?.documents?.signal.aborted).to.be.false;

      // Send cancel request
      await testController.handleWebviewMessage(
        { command: PreviewMessageType.cancelRequest },
        mockPanel,
        options,
      );

      expect(controller?.documents?.signal.aborted).to.be.true;

      findResolve([]);
      await requestPromise;
    });
  });

  suite('handleGetTotalCount', function () {
    test('sends updateTotalCount message with count', async function () {
      const options = createMockOptions();

      await testController.handleGetTotalCount(mockPanel, options);

      expect(mockDataService.aggregate.calledOnce).to.be.true;
      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(message.totalCount).to.equal(16);
    });

    test('returns totalCount of 0 when aggregate returns empty array', async function () {
      mockDataService.aggregate = sandbox.stub().resolves([]);
      const options = createMockOptions();

      await testController.handleGetTotalCount(mockPanel, options);

      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(message.totalCount).to.equal(0);
    });

    test('does not call aggregate for view collections and sends null totalCount', async function () {
      const options = createMockOptions({
        collectionType: CollectionType.view,
      });

      await testController.handleGetTotalCount(mockPanel, options);

      expect(mockDataService.aggregate.called).to.be.false;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(message.totalCount).to.equal(null);
    });

    test('does not call aggregate for timeseries collections and sends null totalCount', async function () {
      const options = createMockOptions({
        collectionType: CollectionType.timeseries,
      });

      await testController.handleGetTotalCount(mockPanel, options);

      expect(mockDataService.aggregate.called).to.be.false;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(message.totalCount).to.equal(null);
    });

    test('does not call aggregate for cursor queries and sends null totalCount', async function () {
      const options = createMockOptions({
        query: {
          options: { method: 'find', args: ['db', 'coll', {}] },
          chains: [],
        } as any,
      });

      await testController.handleGetTotalCount(mockPanel, options);

      expect(mockDataService.aggregate.called).to.be.false;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(PreviewMessageType.updateTotalCount);
      expect(message.totalCount).to.equal(null);
    });

    test('sends updateTotalCountError message when aggregate fails', async function () {
      mockDataService.aggregate = sandbox
        .stub()
        .rejects(new Error('Aggregate failed'));
      const options = createMockOptions();

      await testController.handleGetTotalCount(mockPanel, options);

      expect(postMessageStub.calledOnce).to.be.true;
      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(
        PreviewMessageType.updateTotalCountError,
      );
      expect(message.error).to.equal('Aggregate failed');
    });

    test('posts error message when no active data service', async function () {
      mockConnectionController.getActiveDataService = sandbox
        .stub()
        .returns(null);
      const options = createMockOptions();

      await testController.handleGetTotalCount(mockPanel, options);

      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal(
        PreviewMessageType.updateTotalCountError,
      );
      expect(message.error).to.equal('No active database connection');
    });

    test('does not post message when request is aborted', async function () {
      mockDataService.aggregate = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers
          .get(mockPanel)
          ?.totalCount?.abort();
        return [{ count: 16 }];
      });
      const options = createMockOptions();

      await testController.handleGetTotalCount(mockPanel, options);

      expect(postMessageStub.called).to.be.false;
    });
  });

  suite('handleWebviewMessage for getTotalCount', function () {
    test('calls handleGetTotalCount when getTotalCount message received', async function () {
      const options = createMockOptions();
      const handleGetTotalCountSpy = sandbox.spy(
        testController,
        'handleGetTotalCount',
      );

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.getTotalCount },
        mockPanel,
        options,
      );

      expect(handleGetTotalCountSpy.calledOnce).to.be.true;
      expect(handleGetTotalCountSpy.calledWith(mockPanel, options)).to.be.true;
    });
  });

  test('handleEditDocument calls relevant vscode command', async function () {
    const options = createMockOptions();

    (testController as any)._connectionController = {
      getActiveConnectionId: sandbox.stub().returns('conn-id'),
    };

    const executeCommandStub = sandbox
      .stub(vscode.commands, 'executeCommand')
      .resolves(true);

    await testController.handleEditDocument(options, 'my-id');

    expect(executeCommandStub.calledOnce).to.be.true;
    expect(executeCommandStub.firstCall.args[0]).to.equal(
      ExtensionCommand.mdbOpenMongodbDocumentFromDataBrowser,
    );
    const commandArgs = executeCommandStub.firstCall.args[1];
    expect(commandArgs.documentId).to.equal('my-id');
    expect(commandArgs.namespace).to.equal(
      `${options.databaseName}.${options.collectionName}`,
    );
    expect(commandArgs.connectionId).to.equal('conn-id');
    expect(trackStub.calledOnce).to.be.true;
    expect(trackStub.firstCall.args[0]).to.be.instanceOf(
      DataBrowserDocumentEditedTelemetryEvent,
    );
    expect(trackStub.firstCall.args[0].properties.source).to.equal(
      'collection',
    );
  });

  test('handleEditDocument does not track telemetry when command returns false', async function () {
    const options = createMockOptions();

    (testController as any)._connectionController = {
      getActiveConnectionId: sandbox.stub().returns('conn-id'),
    };

    sandbox.stub(vscode.commands, 'executeCommand').resolves(false);

    await testController.handleEditDocument(options, 'my-id');

    expect(trackStub.called).to.be.false;
  });

  test('handleCloneDocument creates playground without _id', async function () {
    const options = createMockOptions();

    const executeCommandStub = sandbox
      .stub(vscode.commands, 'executeCommand')
      .resolves(true);

    const doc = { _id: '123', name: 'Test' };

    // Note: handleCloneDocument expects a serialized single document (not array)
    const singleSerialized = EJSON.serialize(doc, { relaxed: false });

    await testController.handleCloneDocument(options, singleSerialized);

    expect(executeCommandStub.calledOnce).to.be.true;
    expect(executeCommandStub.firstCall.args[0]).to.equal(
      ExtensionCommand.mdbCloneDocumentFromDataBrowser,
    );
    const commandArgs = executeCommandStub.firstCall.args[1];
    // Verify that _id is not in the documentContents
    expect(commandArgs.documentContents).to.not.include('_id');
    expect(commandArgs.databaseName).to.equal('test');
    expect(commandArgs.collectionName).to.equal('collection');
    expect(trackStub.calledOnce).to.be.true;
    expect(trackStub.firstCall.args[0]).to.be.instanceOf(
      DataBrowserDocumentClonedTelemetryEvent,
    );
    expect(trackStub.firstCall.args[0].properties.source).to.equal(
      'collection',
    );
  });

  test('handleCloneDocument does not track telemetry when command returns false', async function () {
    const options = createMockOptions();

    sandbox.stub(vscode.commands, 'executeCommand').resolves(false);

    const doc = { _id: '123', name: 'Test' };
    const singleSerialized = EJSON.serialize(doc, { relaxed: false });

    await testController.handleCloneDocument(options, singleSerialized);

    expect(trackStub.called).to.be.false;
  });

  test('handleDeleteDocument calls correct vscode command when confirmed', async function () {
    const options = createMockOptions();

    // stub confirm setting
    const getStub = sandbox.stub();
    getStub.withArgs('confirmDeleteDocument').returns(false);

    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .returns({ get: getStub } as any);

    // stub deleteOne on data service
    (mockDataService as any).deleteOne = sandbox
      .stub()
      .resolves({ deletedCount: 1 });

    const executeCommandStub = sandbox
      .stub(vscode.commands, 'executeCommand')
      .resolves(true);

    await testController.handleDeleteDocument(mockPanel, options, 'del-id');

    expect(executeCommandStub.calledOnce).to.be.true;
    expect(executeCommandStub.firstCall.args[0]).to.equal(
      ExtensionCommand.mdbRefreshCollectionFromDataBrowser,
    );
  });

  test('handleDeleteDocument cancels when user declines', async function () {
    const options = createMockOptions();

    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .returns({ get: () => true } as any);
    sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

    (mockDataService as any).deleteOne = sandbox
      .stub()
      .resolves({ deletedCount: 1 });

    await testController.handleDeleteDocument(mockPanel, options, 'del-id');

    expect((mockDataService as any).deleteOne.called).to.be.false;
  });

  suite('handleDeleteAllDocuments', function () {
    test('delegates to mdb.deleteAllDocuments command', async function () {
      const options = createMockOptions();
      const executeCommandStub = sandbox
        .stub(vscode.commands, 'executeCommand')
        .resolves(true);

      (testController as any)._explorerController = mockExplorerController;

      await testController.handleDeleteAllDocuments(options);

      expect(executeCommandStub.calledOnce).to.be.true;
      expect(executeCommandStub.firstCall.args[0]).to.equal(
        'mdb.deleteAllDocuments',
      );

      expect(executeCommandStub.firstCall.args[1]).to.deep.equal({
        ...options,
        view: 'data-browser',
        source: 'collection',
      });
    });

    test('shows error when options have a query', async function () {
      const options = createMockOptions({
        query: {
          options: { method: 'find', args: ['db', 'coll', {}] },
          chains: [],
        } as any,
      });

      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves();

      await testController.handleDeleteAllDocuments(options);

      expect(showErrorStub.calledOnce).to.be.true;
      expect(showErrorStub.firstCall.args[0]).to.include(
        'Delete all documents with a query is not supported',
      );
    });
  });

  suite('handleWebviewMessage for deleteAllDocuments', function () {
    test('calls handleDeleteAllDocuments when deleteAllDocuments message received', async function () {
      const options = createMockOptions();
      const handleDeleteAllSpy = sandbox.spy(
        testController,
        'handleDeleteAllDocuments',
      );

      // Stub executeCommand since handleDeleteAllDocuments now delegates to the command
      sandbox.stub(vscode.commands, 'executeCommand').resolves(true);

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.deleteAllDocuments },
        mockPanel,
        options,
      );

      expect(handleDeleteAllSpy.calledOnce).to.be.true;
      expect(handleDeleteAllSpy.calledWith(options)).to.be.true;
    });
  });

  suite('notifyDocumentsChanged', function () {
    test('sends documentDeleted message to panels matching the namespace', function () {
      const matchingPostMessage = sandbox.stub().resolves(true);
      const matchingPanel = {
        title: 'testDb.testCol',
        webview: { postMessage: matchingPostMessage },
      } as unknown as vscode.WebviewPanel;

      (testController as any)._activeWebviewPanels = [matchingPanel];

      testController.notifyDocumentsChanged('testDb', 'testCol');

      expect(matchingPostMessage.calledOnce).to.be.true;
      expect(matchingPostMessage.firstCall.args[0]).to.deep.equal({
        command: PreviewMessageType.documentDeleted,
      });
    });

    test('does not send message to panels with non-matching title', function () {
      const otherPostMessage = sandbox.stub().resolves(true);
      const otherPanel = {
        title: 'otherDb.otherCol',
        webview: { postMessage: otherPostMessage },
      } as unknown as vscode.WebviewPanel;

      (testController as any)._activeWebviewPanels = [otherPanel];

      testController.notifyDocumentsChanged('testDb', 'testCol');

      expect(otherPostMessage.called).to.be.false;
    });

    test('sends message only to matching panels when multiple are open', function () {
      const matchingPostMessage = sandbox.stub().resolves(true);
      const otherPostMessage = sandbox.stub().resolves(true);

      const matchingPanel = {
        title: 'myDb.myCol',
        webview: { postMessage: matchingPostMessage },
      } as unknown as vscode.WebviewPanel;
      const otherPanel = {
        title: 'myDb.otherCol',
        webview: { postMessage: otherPostMessage },
      } as unknown as vscode.WebviewPanel;

      (testController as any)._activeWebviewPanels = [
        matchingPanel,
        otherPanel,
      ];

      testController.notifyDocumentsChanged('myDb', 'myCol');

      expect(matchingPostMessage.calledOnce).to.be.true;
      expect(otherPostMessage.called).to.be.false;
    });

    test('handles empty active panels gracefully', function () {
      (testController as any)._activeWebviewPanels = [];

      // Should not throw
      testController.notifyDocumentsChanged('testDb', 'testCol');
    });
  });

  test('handleInsertDocument calls playgroundController.createPlaygroundForInsertDocument', async function () {
    const options = createMockOptions();

    const executeCommandStub = sandbox
      .stub(vscode.commands, 'executeCommand')
      .resolves(true);

    await testController.handleInsertDocument(options);

    expect(executeCommandStub.calledOnce).to.be.true;
    expect(executeCommandStub.firstCall.args[0]).to.equal(
      ExtensionCommand.mdbInsertDocumentFromDataBrowser,
    );
    const commandArgs = executeCommandStub.firstCall.args[1];
    expect(commandArgs.databaseName).to.equal('test');
    expect(commandArgs.collectionName).to.equal('collection');
    expect(trackStub.calledOnce).to.be.true;
    expect(trackStub.firstCall.args[0]).to.be.instanceOf(
      DataBrowserDocumentInsertedTelemetryEvent,
    );
    expect(trackStub.firstCall.args[0].properties.view).to.equal(
      'data-browser',
    );
    expect(trackStub.firstCall.args[0].properties.source).to.equal(
      'collection',
    );
  });

  test('handleInsertDocument does not track telemetry when command returns false', async function () {
    const options = createMockOptions();

    sandbox.stub(vscode.commands, 'executeCommand').resolves(false);

    await testController.handleInsertDocument(options);

    expect(trackStub.called).to.be.false;
  });

  test('handleInsertDocument shows error message on failure', async function () {
    const options = createMockOptions();

    sandbox
      .stub(vscode.commands, 'executeCommand')
      .rejects(new Error('Playground error'));

    const showErrorStub = sandbox
      .stub(vscode.window, 'showErrorMessage')
      .resolves();

    await testController.handleInsertDocument(options);

    expect(showErrorStub.calledOnce).to.be.true;
    expect(showErrorStub.firstCall.args[0]).to.include(
      'Failed to open insert document playground',
    );
  });

  suite('handleWebviewMessage for insertDocument', function () {
    test('calls handleInsertDocument when insertDocument message received', async function () {
      const options = createMockOptions();
      const handleInsertDocumentSpy = sandbox.spy(
        testController,
        'handleInsertDocument',
      );

      await testController.handleWebviewMessage(
        { command: PreviewMessageType.insertDocument },
        mockPanel,
        options,
      );

      expect(handleInsertDocumentSpy.calledOnce).to.be.true;
      expect(handleInsertDocumentSpy.calledWith(options)).to.be.true;
    });
  });

  suite('parseConstructionOptions', function () {
    test('returns default find query when no query is provided', function () {
      const result = parseConstructionOptions(undefined);
      expect(result.limit).to.be.null;
      expect(result.skip).to.be.null;
      expect((result as any).find).to.deep.equal({
        filter: {},
        findOptions: {},
        dbOptions: {},
      });
      expect(result.chains).to.deep.equal([]);
    });

    test('throws for unsupported query methods', function () {
      expect(() =>
        parseConstructionOptions({
          options: { method: 'runCursorCommand', args: ['db', {}] },
          chains: [],
        } as any),
      ).to.throw('Only find and aggregate queries are supported');
    });
  });

  suite('parseConstructionOptionsForFind', function () {
    test('extracts limit from findOptions', function () {
      const result = parseConstructionOptionsForFind({
        options: {
          method: 'find',
          args: ['db', 'coll', { name: 'test' }, { limit: 50 }, {}],
        },
        chains: [],
      } as any);
      expect(result.limit).to.equal(50);
      expect(result.skip).to.be.null;
      expect((result as any).find.filter).to.deep.equal({ name: 'test' });
      // limit should be stripped from findOptions
      expect((result as any).find.findOptions.limit).to.be.undefined;
    });

    test('extracts skip from findOptions', function () {
      const result = parseConstructionOptionsForFind({
        options: {
          method: 'find',
          args: ['db', 'coll', {}, { skip: 20 }, {}],
        },
        chains: [],
      } as any);
      expect(result.skip).to.equal(20);
      expect((result as any).find.findOptions.skip).to.be.undefined;
    });

    test('extracts both limit and skip from findOptions', function () {
      const result = parseConstructionOptionsForFind({
        options: {
          method: 'find',
          args: ['db', 'coll', {}, { limit: 30, skip: 10 }, {}],
        },
        chains: [],
      } as any);
      expect(result.limit).to.equal(30);
      expect(result.skip).to.equal(10);
    });

    test('extracts limit from chains', function () {
      const result = parseConstructionOptionsForFind({
        options: { method: 'find', args: ['db', 'coll', {}, {}, {}] },
        chains: [{ method: 'limit', args: [25] }],
      } as any);
      expect(result.limit).to.equal(25);
      // limit chain should be filtered out
      expect(result.chains).to.deep.equal([]);
    });

    test('extracts skip from chains', function () {
      const result = parseConstructionOptionsForFind({
        options: { method: 'find', args: ['db', 'coll', {}, {}, {}] },
        chains: [{ method: 'skip', args: [15] }],
      } as any);
      expect(result.skip).to.equal(15);
      expect(result.chains).to.deep.equal([]);
    });

    test('chains override findOptions for limit and skip', function () {
      const result = parseConstructionOptionsForFind({
        options: {
          method: 'find',
          args: ['db', 'coll', {}, { limit: 10, skip: 5 }, {}],
        },
        chains: [
          { method: 'limit', args: [100] },
          { method: 'skip', args: [50] },
        ],
      } as any);
      // chains should win over findOptions
      expect(result.limit).to.equal(100);
      expect(result.skip).to.equal(50);
    });

    test('preserves non-limit/skip chains', function () {
      const result = parseConstructionOptionsForFind({
        options: { method: 'find', args: ['db', 'coll', {}, {}, {}] },
        chains: [
          { method: 'sort', args: [{ _id: -1 }] },
          { method: 'limit', args: [10] },
          { method: 'project', args: [{ name: 1 }] },
        ],
      } as any);
      expect(result.limit).to.equal(10);
      expect(result.chains).to.have.lengthOf(2);
      expect(result.chains[0].method).to.equal('sort');
      expect(result.chains[1].method).to.equal('project');
    });

    test('does not mutate original query findOptions', function () {
      const originalFindOptions = {
        limit: 10,
        skip: 5,
        projection: { name: 1 },
      };
      const query = {
        options: {
          method: 'find' as const,
          args: ['db', 'coll', {}, originalFindOptions, {}],
        },
        chains: [],
      };
      parseConstructionOptionsForFind(query as any);
      // Original should still have limit and skip
      expect(originalFindOptions.limit).to.equal(10);
      expect(originalFindOptions.skip).to.equal(5);
    });

    test('handles null/undefined findOptions', function () {
      const result = parseConstructionOptionsForFind({
        options: {
          method: 'find',
          args: ['db', 'coll', {}, undefined, undefined],
        },
        chains: [],
      } as any);
      expect(result.limit).to.be.null;
      expect(result.skip).to.be.null;
    });
  });

  suite('parseConstructionOptionsForAggregate', function () {
    test('returns null limit and skip for aggregations', function () {
      const result = parseConstructionOptionsForAggregate({
        options: {
          method: 'aggregate',
          args: [
            'db',
            'coll',
            [{ $match: { status: 'active' } }, { $limit: 10 }],
            {},
            {},
          ],
        },
        chains: [],
      } as any);
      expect(result.limit).to.be.null;
      expect(result.skip).to.be.null;
      expect((result as any).aggregate.pipeline).to.deep.equal([
        { $match: { status: 'active' } },
        { $limit: 10 },
      ]);
    });

    test('preserves all chains for aggregations', function () {
      const result = parseConstructionOptionsForAggregate({
        options: {
          method: 'aggregate',
          args: ['db', 'coll', [{ $match: {} }], {}, {}],
        },
        chains: [
          { method: 'limit', args: [5] },
          { method: 'skip', args: [10] },
        ],
      } as any);
      // Unlike find, aggregate should keep limit/skip in chains
      expect(result.chains).to.have.lengthOf(2);
    });
  });

  suite(
    'handleGetDocuments with find query (pagination + query limits)',
    function () {
      function createFindQueryOptions(overrides?: {
        limit?: number;
        skip?: number;
        filter?: object;
        sort?: object;
      }): DataBrowsingOptions {
        const findOpts: Record<string, any> = Object.create(null);
        if (overrides?.limit) findOpts.limit = overrides.limit;
        if (overrides?.skip) findOpts.skip = overrides.skip;
        if (overrides?.sort) findOpts.sort = overrides.sort;
        return createMockOptions({
          query: {
            options: {
              method: 'find',
              args: [
                'test',
                'collection',
                overrides?.filter ?? {},
                Object.keys(findOpts).length > 0 ? findOpts : undefined,
                undefined,
              ],
            },
            chains: [
              {
                method: 'projection',
                args: [{ name: 1 }],
              },
            ],
          } as any,
        });
      }

      test('query skip offsets pagination skip', async function () {
        const options = createFindQueryOptions({ skip: 10 });
        await testController.handleGetDocuments(mockPanel, options, 0, 10);

        const findOptions = mockServiceProvider.find.firstCall.args[3];
        expect(findOptions.skip).to.equal(10);
      });

      test('query skip adds to pagination skip', async function () {
        const options = createFindQueryOptions({ skip: 10 });
        await testController.handleGetDocuments(mockPanel, options, 20, 10);

        const findOptions = mockServiceProvider.find.firstCall.args[3];
        expect(findOptions.skip).to.equal(30);
      });

      test('query limit caps pagination limit', async function () {
        const options = createFindQueryOptions({ limit: 25 });
        await testController.handleGetDocuments(mockPanel, options, 0, 10);

        const findOptions = mockServiceProvider.find.firstCall.args[3];
        expect(findOptions.limit).to.equal(10);
      });

      test('query limit reduces available on later pages', async function () {
        const options = createFindQueryOptions({ limit: 25 });
        await testController.handleGetDocuments(mockPanel, options, 20, 10);

        const findOptions = mockServiceProvider.find.firstCall.args[3];
        // remaining = 25 - 20 = 5, min(5, 10) = 5
        expect(findOptions.limit).to.equal(5);
      });

      test('returns empty when past query limit', async function () {
        const options = createFindQueryOptions({ limit: 10 });
        await testController.handleGetDocuments(mockPanel, options, 10, 10);

        const message = findMessageByCommand(
          postMessageStub,
          PreviewMessageType.loadPage,
        ) as any;
        expect(message.documents).to.deep.equal([]);
      });

      test('query skip + limit boundary returns empty past limit', async function () {
        const options = createFindQueryOptions({ skip: 10, limit: 20 });
        // skip=10 in query, limit=20, pagination skip=30
        // findOptions.skip = 10 + 30 = 40, remaining = 20 - 40 = -20 < 1 => empty
        await testController.handleGetDocuments(mockPanel, options, 30, 10);

        const message = findMessageByCommand(
          postMessageStub,
          PreviewMessageType.loadPage,
        ) as any;
        expect(message.documents).to.deep.equal([]);
      });

      test('passes filter from query to find', async function () {
        const options = createFindQueryOptions({
          filter: { status: 'active' },
        });
        await testController.handleGetDocuments(mockPanel, options, 0, 10);

        const filter = mockServiceProvider.find.firstCall.args[2];
        expect(filter).to.deep.equal({ status: 'active' });
      });
    },
  );

  suite('handleGetDocuments with aggregate query', function () {
    function createAggregateQueryOptions(
      pipeline?: object[],
    ): DataBrowsingOptions {
      return createMockOptions({
        query: {
          options: {
            method: 'aggregate',
            args: [
              'test',
              'collection',
              pipeline ?? [{ $match: { status: 'active' } }],
              {},
              {},
            ],
          },
          chains: [
            {
              method: 'limit',
              args: [25],
            },
          ],
        } as any,
      });
    }

    test('appends $skip and $limit to pipeline', async function () {
      const options = createAggregateQueryOptions([{ $match: {} }]);
      await testController.handleGetDocuments(mockPanel, options, 20, 10);

      const pipeline = mockServiceProvider.aggregate.firstCall.args[2];
      expect(pipeline).to.deep.equal([
        { $match: {} },
        { $skip: 20 },
        { $limit: 10 },
      ]);
    });

    test('works with existing $limit/$skip in pipeline', async function () {
      const options = createAggregateQueryOptions([
        { $match: {} },
        { $skip: 5 },
        { $limit: 50 },
      ]);
      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      const pipeline = mockServiceProvider.aggregate.firstCall.args[2];
      expect(pipeline).to.deep.equal([
        { $match: {} },
        { $skip: 5 },
        { $limit: 50 },
        { $skip: 10 },
        { $limit: 10 },
      ]);
    });

    test('first page has $skip: 0', async function () {
      const options = createAggregateQueryOptions();
      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      const pipeline = mockServiceProvider.aggregate.firstCall.args[2];
      const lastSkip = pipeline[pipeline.length - 2];
      expect(lastSkip).to.deep.equal({ $skip: 0 });
    });
  });
});
