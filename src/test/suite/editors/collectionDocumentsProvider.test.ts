import assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';

import CollectionDocumentsProvider, { VIEW_COLLECTION_SCHEME } from '../../../editors/collectionDocumentsProvider';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';
import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';
import TelemetryService from '../../../telemetry/telemetryService';

const mockDocumentsAsJsonString = `[
  {
    "_id": "first_id",
    "field1": "first_field"
  },
  {
    "_id": "first_id",
    "field1": "first_field"
  }
]`;

suite('Collection Documents Provider Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryService = new TelemetryService(
    mockStorageController,
    mockExtensionContext
  );

  afterEach(() => {
    sinon.restore();
  });

  test('expected provideTextDocumentContent to parse uri and return documents in the form of a string from a find call', (done) => {
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        assert(
          namespace === 'my-favorite-fruit-is.pineapple',
          `Expected find namespace to be 'my-favorite-fruit-is.pineapple' found ${namespace}`
        );

        assert(
          options.limit === 10,
          `Expected find limit to be 10, found ${options.limit}`
        );

        return callback(null, ['Declaration of Independence']);
      }
    };

    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryService
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockExtensionContext,
      mockConnectionController,
      testQueryStore,
      new StatusView(mockExtensionContext)
    );

    const operationId = testQueryStore.createNewOperation();

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=my-favorite-fruit-is.pineapple&operationId=${operationId}`
    );

    testCollectionViewProvider
      .provideTextDocumentContent(uri)
      .then((documents) => {
        assert(
          documents.includes('Declaration of Independence'),
          `Expected provideTextDocumentContent to return documents string, found ${documents}`
        );
        done();
      })
      .catch(done);
  });

  test('expected provideTextDocumentContent to return a ejson.stringify string', (done) => {
    const mockDocuments = [
      {
        _id: 'first_id',
        field1: 'first_field'
      },
      {
        _id: 'first_id',
        field1: 'first_field'
      }
    ];

    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, mockDocuments);
      }
    };
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryService
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockExtensionContext,
      mockConnectionController,
      testQueryStore,
      new StatusView(mockExtensionContext)
    );

    const operationId = testQueryStore.createNewOperation();

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=test.test&operationId=${operationId}`
    );

    testCollectionViewProvider
      .provideTextDocumentContent(uri)
      .then((documents) => {
        assert(
          documents === mockDocumentsAsJsonString,
          `Expected provideTextDocumentContent to return ejson stringified string, found ${documents}`
        );
        done();
      })
      .catch(done);
  });

  test('expected provideTextDocumentContent to set hasMoreDocumentsToShow to false when there arent more documents', (done) => {
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, ['Apollo', 'Gemini ']);
      }
    };
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryService
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockExtensionContext,
      mockConnectionController,
      testQueryStore,
      new StatusView(mockExtensionContext)
    );

    const operationId = testQueryStore.createNewOperation();
    testQueryStore.operations[operationId].currentLimit = 5;

    assert(testQueryStore.operations[operationId].hasMoreDocumentsToShow);

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=vostok.mercury&operationId=${operationId}`
    );

    testCollectionViewProvider.provideTextDocumentContent(uri).then(() => {
      assert(
        testQueryStore.operations[operationId].hasMoreDocumentsToShow === false,
        'Expected not to have more documents to show.'
      );

      // Reset and test inverse.
      testQueryStore.operations[operationId].currentLimit = 2;
      testQueryStore.operations[operationId].hasMoreDocumentsToShow = true;

      testCollectionViewProvider
        .provideTextDocumentContent(uri)
        .then(() => {
          assert(testQueryStore.operations[operationId].hasMoreDocumentsToShow);

          done();
        })
        .catch(done);
    });
  });

  test('provideTextDocumentContent shows a status bar item while it is running then hide it', (done) => {
    const mockActiveConnection = { find: {} };
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryService
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testStatusView = new StatusView(mockExtensionContext);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockExtensionContext,
      mockConnectionController,
      testQueryStore,
      testStatusView
    );

    const operationId = testQueryStore.createNewOperation();

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=aaaaaaaa&operationId=${operationId}`
    );

    const mockShowMessage = sinon.fake();
    sinon.replace(testStatusView, 'showMessage', mockShowMessage);

    const mockHideMessage = sinon.fake();
    sinon.replace(testStatusView, 'hideMessage', mockHideMessage);

    mockActiveConnection.find = (
      namespace,
      filter,
      options,
      callback
    ): void => {
      assert(mockShowMessage.called);
      assert(!mockHideMessage.called);
      assert(mockShowMessage.firstCall.args[0] === 'Fetching documents...');

      return callback(null, ['aaaaaaaaaaaaaaaaa']);
    };

    testCollectionViewProvider
      .provideTextDocumentContent(uri)
      .then(() => {
        assert(mockHideMessage.called);
      })
      .then(done, done);
  });

  test('provideTextDocumentContent registers two code lens providers for two different collections', async () => {
    const connectionId = '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487';
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryService
    );
    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockExtensionContext,
      mockConnectionController,
      testQueryStore,
      new StatusView(mockExtensionContext)
    );

    testCollectionViewProvider._operationsStore = new CollectionDocumentsOperationsStore();

    const mockRegisterCodeLensProvider: any = sinon.fake.resolves([]);
    sinon.replace(vscode.languages, 'registerCodeLensProvider', mockRegisterCodeLensProvider);

    const mockActiveConnectionId = sinon.fake.returns(connectionId);
    sinon.replace(
      testCollectionViewProvider._connectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const documents: any[] = [ { _id: '5ea8745ee4811fafe8b65ecb', koko: 'nothing5' } ];
    const mockGetActiveDataService = sinon.fake.returns({
      find: (
        namespace: string,
        filter: object,
        options: object,
        callback: (error: Error | null, result: object) => void
      ) => {
        return callback(null, documents);
      }
    });
    sinon.replace(
      testCollectionViewProvider._connectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );

    const mockShowMessage = sinon.fake();
    sinon.replace(testCollectionViewProvider._statusView, 'showMessage', mockShowMessage);

    const mockHideMessage = sinon.fake();
    sinon.replace(testCollectionViewProvider._statusView, 'hideMessage', mockHideMessage);

    const firstOperationId = testCollectionViewProvider._operationsStore.createNewOperation();
    const firstCollectionNamespace = 'berlin.cocktailbars';
    const firstCollectionQuery = [
      `namespace=${firstCollectionNamespace}`,
      `connectionId=${connectionId}`,
      `operationId=${firstOperationId}`
    ].join('&');
    const firstCollectionUri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${firstCollectionNamespace}.json?${firstCollectionQuery}`
    );

    testCollectionViewProvider._registerCodeLensProviderForCollection({
      uri: firstCollectionUri,
      documents,
      namespace: firstCollectionNamespace
    });

    await testCollectionViewProvider.provideTextDocumentContent(firstCollectionUri);

    const fisrtSelector = mockRegisterCodeLensProvider.firstArg;

    assert(!!fisrtSelector);
    assert(fisrtSelector.scheme === 'VIEW_COLLECTION_SCHEME');
    assert(fisrtSelector.language === 'json');
    assert(fisrtSelector.pattern === 'Results: berlin.cocktailbars.json');

    const firstProvider = mockRegisterCodeLensProvider.lastArg;

    assert(!!firstProvider);
    assert(firstProvider._codeLensesInfo.length === 1);
    assert(firstProvider._codeLensesInfo[0].documentId === '5ea8745ee4811fafe8b65ecb');
    assert(firstProvider._codeLensesInfo[0].source === 'collectionview');
    assert(firstProvider._codeLensesInfo[0].line === 2);
    assert(firstProvider._codeLensesInfo[0].namespace === firstCollectionNamespace);
    assert(firstProvider._codeLensesInfo[0].connectionId === connectionId);

    const secondOperationId = testCollectionViewProvider._operationsStore.createNewOperation();
    const secondCollectionNamespace = 'companies.companies';
    const secondCollectionQuery = [
      `namespace=${secondCollectionNamespace}`,
      `connectionId=${connectionId}`,
      `operationId=${secondOperationId}`
    ].join('&');
    const secondCollectionUri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${secondCollectionNamespace}.json?${secondCollectionQuery}`
    );

    documents.length = 0;
    documents.push(
      { _id: '25', name: 'some name', price: 1000 },
      { _id: '26', name: 'another name', price: 500 }
    );

    testCollectionViewProvider._registerCodeLensProviderForCollection({
      uri: secondCollectionUri,
      documents,
      namespace: secondCollectionNamespace
    });

    await testCollectionViewProvider.provideTextDocumentContent(secondCollectionUri);

    const secondSelector = mockRegisterCodeLensProvider.firstArg;

    assert(!!secondSelector);
    assert(secondSelector.scheme === 'VIEW_COLLECTION_SCHEME');
    assert(secondSelector.language === 'json');
    assert(secondSelector.pattern === 'Results: companies.companies.json');

    const secondProvider = mockRegisterCodeLensProvider.lastArg;

    assert(!!secondProvider);
    assert(secondProvider._codeLensesInfo.length === 2);
    assert(secondProvider._codeLensesInfo[1].documentId === '26');
    assert(secondProvider._codeLensesInfo[1].source === 'collectionview');
    assert(secondProvider._codeLensesInfo[1].line === 7);
    assert(secondProvider._codeLensesInfo[1].namespace === secondCollectionNamespace);
    assert(secondProvider._codeLensesInfo[1].connectionId === connectionId);
  });
});
