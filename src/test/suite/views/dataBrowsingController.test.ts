import sinon, { type SinonSandbox, type SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { expect } from 'chai';
import { beforeEach, afterEach } from 'mocha';

import DataBrowsingController from '../../../views/dataBrowsingController';
import { PreviewMessageType } from '../../../views/data-browsing-app/extension-app-message-constants';
import type { DataBrowsingOptions } from '../../../views/dataBrowsingController';
import { CollectionType } from '../../../explorer/documentUtils';
import { EJSON } from 'bson';

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
      databaseName: 'test',
      collectionName: 'collection',
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
      editorsController: {} as any,
      playgroundController: {} as any,
      telemetryService: {} as any,
    });
    mockPanel = createMockPanel();
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
      mockDataService.find = sandbox.stub().callsFake(async () => {
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
      mockDataService.find = sandbox.stub().callsFake(async () => {
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
      mockDataService.find = sandbox.stub().callsFake(async () => {
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
      testController.onWebviewPanelClosed(mockPanel);

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
      mockDataService.find = sandbox.stub().callsFake(async () => {
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
      mockDataService.find = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers
          .get(mockPanel)
          ?.documents?.abort();
        return [{ _id: '1', name: 'test' }];
      });
      mockDataService.aggregate = sandbox.stub().resolves([{ count: 16 }]);

      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      // No messages should be posted
      expect(postMessageStub.callCount).to.equal(0);
    });

    test('does not throw when error occurs on aborted request', async function () {
      // Abort the controller and throw an error during find
      mockDataService.find = sandbox.stub().callsFake(() => {
        testController._panelAbortControllers
          .get(mockPanel)
          ?.documents?.abort();
        throw new Error('Connection error');
      });
      mockDataService.aggregate = sandbox.stub().resolves([{ count: 16 }]);

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

      expect(mockDataService.find.calledOnce).to.be.true;
      const executionOptions = mockDataService.find.firstCall.args[3];
      expect(executionOptions.abortSignal).to.be.instanceOf(AbortSignal);
    });
  });

  suite('Successful request handling', function () {
    test('posts loadPage message with documents on initial handleGetDocuments', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      expect(mockDataService.find.calledOnce).to.be.true;
      expect(postMessageStub.callCount).to.equal(1);
      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.loadPage,
      ) as { command: string; documents: unknown[] };
      expect(message).to.not.be.undefined;
      expect(message.documents).to.deep.equal([{ _id: '1', name: 'test' }]);
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
      mockDataService.find = sandbox
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
    test('posts error message when no active data service', async function () {
      mockConnectionController.getActiveDataService = sandbox
        .stub()
        .returns(null);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.getDocumentError,
      ) as { command: string; error: string };
      expect(message).to.not.be.undefined;
      expect(message.error).to.equal('No active database connection');
    });

    test('posts error message for handleGetDocuments with pagination when no active data service', async function () {
      mockConnectionController.getActiveDataService = sandbox
        .stub()
        .returns(null);
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 10, 10);

      const message = findMessageByCommand(
        postMessageStub,
        PreviewMessageType.getDocumentError,
      ) as { command: string; error: string };
      expect(message).to.not.be.undefined;
      expect(message.error).to.equal('No active database connection');
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

  suite('handleGetDocuments with pagination', function () {
    test('posts loadPage message with documents on pagination', async function () {
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

      const findOptions = mockDataService.find.firstCall.args[2];
      expect(findOptions.limit).to.equal(25);
      // skip should not be set when 0
      expect(findOptions.skip).to.be.undefined;
    });

    test('passes sort to find call when sort is provided', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10, {
        _id: -1,
      });

      expect(mockDataService.find.calledOnce).to.be.true;
      const findOptions = mockDataService.find.firstCall.args[2];
      expect(findOptions.sort).to.deep.equal({ _id: -1 });
    });

    test('does not include sort in find options when sort is not provided', async function () {
      const options = createMockOptions();

      await testController.handleGetDocuments(mockPanel, options, 0, 10);

      expect(mockDataService.find.calledOnce).to.be.true;
      const findOptions = mockDataService.find.firstCall.args[2];
      expect(findOptions.sort).to.be.undefined;
    });

    test('posts getDocumentError message on fetch failure', async function () {
      mockDataService.find = sandbox
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
      mockDataService.find = sandbox.stub().callsFake(() => {
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

  test('handleEditDocument calls editorsController.openMongoDBDocument', async function () {
    const options = createMockOptions();

    (testController as any)._connectionController = {
      getActiveConnectionId: sandbox.stub().returns('conn-id'),
    };

    const openSpy = sandbox.stub().resolves(true);
    // attach editors controller
    (testController as any)._editorsController = {
      openMongoDBDocument: openSpy,
    };

    await testController.handleEditDocument(options, 'my-id');

    expect(openSpy.calledOnce).to.be.true;
    const arg = openSpy.firstCall.args[0];
    expect(arg.documentId).to.equal('my-id');
    expect(arg.namespace).to.equal(
      `${options.databaseName}.${options.collectionName}`,
    );
    expect(arg.source).to.equal('databrowser');
  });

  test('handleCloneDocument creates playground without _id', async function () {
    const options = createMockOptions();

    const createPlaygroundStub = sandbox.stub().resolves(true);
    (testController as any)._playgroundController = {
      createPlaygroundForCloneDocument: createPlaygroundStub,
    };

    const doc = { _id: '123', name: 'Test' };

    // Note: handleCloneDocument expects a serialized single document (not array)
    const singleSerialized = EJSON.serialize(doc, { relaxed: false });

    await testController.handleCloneDocument(options, singleSerialized);

    expect(createPlaygroundStub.calledOnce).to.be.true;
    const calledWith = createPlaygroundStub.firstCall.args;
    // first arg is document contents string, second is database name, third is collection name
    expect(calledWith[1]).to.equal('test');
    expect(calledWith[2]).to.equal('collection');
  });

  test('handleDeleteDocument deletes and notifies webview when confirmed', async function () {
    const options = createMockOptions();

    // stub confirm setting
    const getStub = sandbox.stub();
    getStub.withArgs('confirmDeleteDocument').returns(false);

    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .returns({ get: getStub } as any);

    // stub executeCommand
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

    // stub deleteOne on data service
    (mockDataService as any).deleteOne = sandbox
      .stub()
      .resolves({ deletedCount: 1 });

    // make sure we use the mock data service
    (testController as any)._connectionController = {
      getActiveDataService: () => {
        return mockDataService;
      },
    };

    await testController.handleDeleteDocument(mockPanel, options, 'del-id');

    expect(getStub.calledWith('confirmDeleteDocument')).to.be.true;

    expect((mockDataService as any).deleteOne.calledOnce).to.be.true;
    const deleteArgs = (mockDataService as any).deleteOne.firstCall.args;
    expect(deleteArgs[0]).to.equal(
      `${options.databaseName}.${options.collectionName}`,
    );
    expect(deleteArgs[1]).to.deep.equal({ _id: 'del-id' });

    // webview notified
    const msg = postMessageStub
      .getCalls()
      .find((c) => c.args[0].command === PreviewMessageType.documentDeleted);
    expect(msg).to.not.be.undefined;

    // refresh command called
    expect(executeCommandStub.calledWith('mdbRefreshCollection')).to.be.true;
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
});
