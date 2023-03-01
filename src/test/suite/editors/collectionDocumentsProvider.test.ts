import * as vscode from 'vscode';
import assert from 'assert';
import { beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';

import { DocumentSource } from '../../../documentSource';
import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';
import CollectionDocumentsProvider, {
  VIEW_COLLECTION_SCHEME,
} from '../../../editors/collectionDocumentsProvider';
import ConnectionController from '../../../connectionController';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { StorageLocation } from '../../../storage/storageController';
import TelemetryService from '../../../telemetry/telemetryService';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { ExtensionContextStub, mockTextEditor } from '../stubs';

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
  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
  );
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sinon.stub(vscode.window, 'showInformationMessage');
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  test('provideTextDocumentContent parses uri and return documents in the form of a string from a find call', async () => {
    const findStub = sinon.stub();
    findStub.resolves([{ field: 'Declaration of Independence' }]);
    const testDataService = {
      find: findStub,
    } as Pick<DataService, 'find'> as unknown as DataService;

    const testConnectionController = new ConnectionController(
      new StatusView(extensionContextStub),
      testStorageController,
      testTelemetryService
    );
    testConnectionController.setActiveDataService(testDataService);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      extensionContextStub,
      testConnectionController,
      testQueryStore,
      new StatusView(extensionContextStub),
      testCodeLensProvider
    );

    const operationId = testQueryStore.createNewOperation();
    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=my-favorite-fruit-is.pineapple&operationId=${operationId}`
    );

    sinon.stub(testCollectionViewProvider._statusView, 'showMessage');
    sinon.stub(testCollectionViewProvider._statusView, 'hideMessage');

    const documents =
      await testCollectionViewProvider.provideTextDocumentContent(uri);
    assert.strictEqual(
      findStub.firstCall.args[0],
      'my-favorite-fruit-is.pineapple'
    );
    assert.strictEqual(findStub.firstCall.args[2]?.limit, 10);
    assert(
      documents.includes('Declaration of Independence'),
      `Expected provideTextDocumentContent to return documents string, found ${documents}`
    );
  });

  test('provideTextDocumentContent returns a ejson.stringify string', async () => {
    const mockDocuments = [
      {
        _id: 'first_id',
        field1: 'first_field',
      },
      {
        _id: 'first_id',
        field1: 'first_field',
      },
    ];

    const findStub = sinon.stub();
    findStub.resolves(mockDocuments);
    const testDataService = {
      find: findStub,
    } as Pick<DataService, 'find'> as unknown as DataService;

    const testConnectionController = new ConnectionController(
      new StatusView(extensionContextStub),
      testStorageController,
      testTelemetryService
    );
    testConnectionController.setActiveDataService(testDataService);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      extensionContextStub,
      testConnectionController,
      testQueryStore,
      new StatusView(extensionContextStub),
      testCodeLensProvider
    );

    const operationId = testQueryStore.createNewOperation();
    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=test.test&operationId=${operationId}`
    );

    sinon.stub(testCollectionViewProvider._statusView, 'showMessage');
    sinon.stub(testCollectionViewProvider._statusView, 'hideMessage');

    const documents =
      await testCollectionViewProvider.provideTextDocumentContent(uri);
    assert.strictEqual(
      documents,
      mockDocumentsAsJsonString,
      `Expected provideTextDocumentContent to return ejson stringified string, found ${documents}`
    );
  });

  test('provideTextDocumentContent sets hasMoreDocumentsToShow to false when there arent more documents', async () => {
    const findStub = sinon.stub();
    findStub.resolves([{ field: 'Apollo' }, { field: 'Gemini ' }]);
    const testDataService = {
      find: findStub,
    } as Pick<DataService, 'find'> as unknown as DataService;
    const testConnectionController = new ConnectionController(
      new StatusView(extensionContextStub),
      testStorageController,
      testTelemetryService
    );
    testConnectionController.setActiveDataService(testDataService);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      extensionContextStub,
      testConnectionController,
      testQueryStore,
      new StatusView(extensionContextStub),
      testCodeLensProvider
    );

    const operationId = testQueryStore.createNewOperation();
    testQueryStore.operations[operationId].currentLimit = 5;

    assert(testQueryStore.operations[operationId].hasMoreDocumentsToShow);

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=vostok.mercury&operationId=${operationId}`
    );

    sinon.stub(testCollectionViewProvider._statusView, 'showMessage');
    sinon.stub(testCollectionViewProvider._statusView, 'hideMessage');

    await testCollectionViewProvider.provideTextDocumentContent(uri);
    assert(
      testQueryStore.operations[operationId].hasMoreDocumentsToShow === false,
      'Expected not to have more documents to show.'
    );

    // Reset and test inverse.
    testQueryStore.operations[operationId].currentLimit = 2;
    testQueryStore.operations[operationId].hasMoreDocumentsToShow = true;

    await testCollectionViewProvider.provideTextDocumentContent(uri);
    assert(testQueryStore.operations[operationId].hasMoreDocumentsToShow);
  });

  test('provideTextDocumentContent shows a status bar item while it is running then hide it', async () => {
    const mockActiveDataService = { find: () => Promise.resolve([]) } as Pick<
      DataService,
      'find'
    > as unknown as DataService;
    const testConnectionController = new ConnectionController(
      new StatusView(extensionContextStub),
      testStorageController,
      testTelemetryService
    );
    testConnectionController.setActiveDataService(mockActiveDataService);

    const testStatusView = new StatusView(extensionContextStub);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      extensionContextStub,
      testConnectionController,
      testQueryStore,
      testStatusView,
      testCodeLensProvider
    );

    const operationId = testQueryStore.createNewOperation();
    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=aaaaaaaa&operationId=${operationId}`
    );

    const showMessageStub = sinon.stub(testStatusView, 'showMessage');
    const hideMessageStub = sinon.stub(testStatusView, 'hideMessage');

    mockActiveDataService.find = () => {
      assert(showMessageStub.called);
      assert(!hideMessageStub.called);
      assert(showMessageStub.firstCall.args[0] === 'Fetching documents...');

      return Promise.resolve([{ field: 'aaaaaaaaaaaaaaaaa' }]);
    };

    await testCollectionViewProvider.provideTextDocumentContent(uri);
    assert(hideMessageStub.called);
  });

  test('provideTextDocumentContent sets different code lenses for different namespaces from the same connection', async () => {
    const testConnectionController = new ConnectionController(
      new StatusView(extensionContextStub),
      testStorageController,
      testTelemetryService
    );
    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      extensionContextStub,
      testConnectionController,
      testQueryStore,
      new StatusView(extensionContextStub),
      testCodeLensProvider
    );

    testCollectionViewProvider._operationsStore =
      new CollectionDocumentsOperationsStore();

    const documents: { _id: string; name?: string; price?: number }[] = [
      { _id: '5ea8745ee4811fafe8b65ecb', name: 'nothing5' },
    ];
    const fakeGetActiveDataService = sinon.fake.returns({
      find: () => {
        return Promise.resolve(documents);
      },
    });
    sinon.replace(
      testCollectionViewProvider._connectionController,
      'getActiveDataService',
      fakeGetActiveDataService
    );
    sinon.stub(testCollectionViewProvider._statusView, 'showMessage');
    sinon.stub(testCollectionViewProvider._statusView, 'hideMessage');

    const connectionId = '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487';
    const fakeActiveConnectionId = sinon.fake.returns(connectionId);
    sinon.replace(
      testCollectionViewProvider._connectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId
    );

    const firstCollectionOperationId =
      testCollectionViewProvider._operationsStore.createNewOperation();
    const firstCollectionNamespace = 'berlin.cocktailbars';
    const firstCollectionQuery = [
      `namespace=${firstCollectionNamespace}`,
      `connectionId=${connectionId}`,
      `operationId=${firstCollectionOperationId}`,
    ].join('&');
    const firstCollectionUri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${firstCollectionNamespace}.json?${firstCollectionQuery}`
    );

    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = firstCollectionUri;
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () => activeTextEditor
    );

    await testCollectionViewProvider.provideTextDocumentContent(
      firstCollectionUri
    );

    let codeLenses = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLenses);
    assert(codeLenses.length === 1);

    let firstCodeLensRange = codeLenses[0].range;
    let firstExpectedStartLine = 2;

    assert(
      firstCodeLensRange.start.line === firstExpectedStartLine,
      `Expected a codeLens position to be at line ${firstExpectedStartLine}, found ${firstCodeLensRange.start.line}`
    );
    assert(codeLenses[0].command?.title === 'Edit Document');

    const firstCollectionFirstCommandArguments =
      codeLenses[0].command?.arguments;

    assert(!!firstCollectionFirstCommandArguments);
    assert(
      firstCollectionFirstCommandArguments[0].source ===
        DocumentSource.DOCUMENT_SOURCE_COLLECTIONVIEW
    );
    assert(
      firstCollectionFirstCommandArguments[0].namespace ===
        firstCollectionNamespace
    );
    assert(
      firstCollectionFirstCommandArguments[0].connectionId === connectionId
    );
    assert(
      firstCollectionFirstCommandArguments[0].documentId ===
        '5ea8745ee4811fafe8b65ecb'
    );

    let codeLensesInfo = testCodeLensProvider._codeLensesInfo;

    assert(Object.keys(codeLensesInfo).length === 1);

    let firstCollectionCodeLensesInfo =
      testCodeLensProvider._codeLensesInfo[firstCollectionUri.toString()];

    assert(!!firstCollectionCodeLensesInfo);
    assert(
      firstCollectionCodeLensesInfo[0].documentId === '5ea8745ee4811fafe8b65ecb'
    );

    // Connect to another connection.
    const secondCollectionOperationId =
      testCollectionViewProvider._operationsStore.createNewOperation();
    const secondCollectionNamespace = 'companies.companies';
    const secondCollectionQuery = [
      `namespace=${secondCollectionNamespace}`,
      `connectionId=${connectionId}`,
      `operationId=${secondCollectionOperationId}`,
    ].join('&');
    const secondCollectionUri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${secondCollectionNamespace}.json?${secondCollectionQuery}`
    );

    // Fake a new response from find.
    documents.length = 0;
    documents.push(
      { _id: '25', name: 'some name', price: 1000 },
      { _id: '26', name: 'another name', price: 500 }
    );

    await testCollectionViewProvider.provideTextDocumentContent(
      secondCollectionUri
    );
    codeLenses = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLenses);
    assert(codeLenses.length === 1);

    firstCodeLensRange = codeLenses[0].range;
    firstExpectedStartLine = 2;

    assert(
      firstCodeLensRange.start.line === firstExpectedStartLine,
      `Expected a codeLens position to be at line ${firstExpectedStartLine}, found ${firstCodeLensRange.start.line}`
    );
    assert(codeLenses[0].command?.title === 'Edit Document');

    const secondCollectionFirstCommandArguments =
      codeLenses[0].command?.arguments;

    assert(!!secondCollectionFirstCommandArguments);
    assert(
      secondCollectionFirstCommandArguments[0].source ===
        DocumentSource.DOCUMENT_SOURCE_COLLECTIONVIEW
    );
    assert(
      secondCollectionFirstCommandArguments[0].namespace ===
        firstCollectionNamespace
    );
    assert(
      secondCollectionFirstCommandArguments[0].connectionId === connectionId
    );
    assert(
      secondCollectionFirstCommandArguments[0].documentId ===
        '5ea8745ee4811fafe8b65ecb'
    );

    codeLensesInfo = testCodeLensProvider._codeLensesInfo;

    assert(Object.keys(codeLensesInfo).length === 2);

    firstCollectionCodeLensesInfo =
      testCodeLensProvider._codeLensesInfo[firstCollectionUri.toString()];

    assert(
      firstCollectionCodeLensesInfo[0].documentId === '5ea8745ee4811fafe8b65ecb'
    );

    const secondCollectionCodeLensesInfo =
      testCodeLensProvider._codeLensesInfo[secondCollectionUri.toString()];

    assert(!!secondCollectionCodeLensesInfo);
    assert(secondCollectionCodeLensesInfo[1].documentId === '26');
  });

  test('provideTextDocumentContent sets different code lenses for identical namespaces from the different connections', async () => {
    const testConnectionController = new ConnectionController(
      new StatusView(extensionContextStub),
      testStorageController,
      testTelemetryService
    );
    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      extensionContextStub,
      testConnectionController,
      testQueryStore,
      new StatusView(extensionContextStub),
      testCodeLensProvider
    );

    testCollectionViewProvider._operationsStore =
      new CollectionDocumentsOperationsStore();

    const documents: { _id: string; location?: string; district?: string }[] = [
      { _id: '5ea8745ee4811fafe8b65ecb', location: 'alexanderplatz' },
    ];
    const fakeGetActiveDataService = sinon.fake.returns({
      find: () => {
        return Promise.resolve(documents);
      },
    });
    sinon.replace(
      testCollectionViewProvider._connectionController,
      'getActiveDataService',
      fakeGetActiveDataService
    );
    sinon.stub(testCollectionViewProvider._statusView, 'showMessage');
    sinon.stub(testCollectionViewProvider._statusView, 'hideMessage');

    const firstConnectionId = '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487';
    const secondConnectionId = '333c2b06-hhhh-40b7-bd8a-bd1f8333a896';

    testConnectionController._connections = {
      [firstConnectionId]: {
        id: firstConnectionId,
        name: 'localhost',
        connectionOptions: { connectionString: TEST_DATABASE_URI },
        storageLocation: StorageLocation.NONE,
      },
      [secondConnectionId]: {
        id: secondConnectionId,
        name: 'compass',
        connectionOptions: { connectionString: TEST_DATABASE_URI },
        storageLocation: StorageLocation.NONE,
      },
    };

    await testConnectionController.connectWithConnectionId(firstConnectionId);

    const firstCollectionOperationId =
      testCollectionViewProvider._operationsStore.createNewOperation();
    const firstCollectionNamespace = 'berlin.places';
    const firstCollectionQuery = [
      `namespace=${firstCollectionNamespace}`,
      `connectionId=${firstConnectionId}`,
      `operationId=${firstCollectionOperationId}`,
    ].join('&');
    const firstCollectionUri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${firstCollectionNamespace}.json?${firstCollectionQuery}`
    );

    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = firstCollectionUri;
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () => activeTextEditor
    );

    await testCollectionViewProvider.provideTextDocumentContent(
      firstCollectionUri
    );

    let codeLenses = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLenses);
    assert(codeLenses.length === 1);

    let firstCodeLensRange = codeLenses[0].range;
    let firstExpectedStartLine = 2;

    assert(
      firstCodeLensRange.start.line === firstExpectedStartLine,
      `Expected a codeLens position to be at line ${firstExpectedStartLine}, found ${firstCodeLensRange.start.line}`
    );
    assert(codeLenses[0].command?.title === 'Edit Document');

    const firstCollectionFirstCommandArguments =
      codeLenses[0].command?.arguments;

    assert(!!firstCollectionFirstCommandArguments);
    assert(
      firstCollectionFirstCommandArguments[0].source ===
        DocumentSource.DOCUMENT_SOURCE_COLLECTIONVIEW
    );
    assert(
      firstCollectionFirstCommandArguments[0].namespace ===
        firstCollectionNamespace
    );
    assert(
      firstCollectionFirstCommandArguments[0].connectionId === firstConnectionId
    );
    assert(
      firstCollectionFirstCommandArguments[0].documentId ===
        '5ea8745ee4811fafe8b65ecb'
    );

    let codeLensesInfo = testCodeLensProvider._codeLensesInfo;

    assert(Object.keys(codeLensesInfo).length === 1);

    let firstCollectionCodeLensesInfo =
      testCodeLensProvider._codeLensesInfo[firstCollectionUri.toString()];

    assert(!!firstCollectionCodeLensesInfo);
    assert(
      firstCollectionCodeLensesInfo[0].documentId === '5ea8745ee4811fafe8b65ecb'
    );

    // Connect to another connection.
    await testConnectionController.connectWithConnectionId(secondConnectionId);

    const secondCollectionOperationId =
      testCollectionViewProvider._operationsStore.createNewOperation();
    const secondCollectionNamespace = 'berlin.places';
    const secondCollectionQuery = [
      `namespace=${secondCollectionNamespace}`,
      `connectionId=${secondConnectionId}`,
      `operationId=${secondCollectionOperationId}`,
    ].join('&');
    const secondCollectionUri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${secondCollectionNamespace}.json?${secondCollectionQuery}`
    );

    mockTextEditor.document.uri = secondCollectionUri;

    // Fake a new response from find.
    documents.length = 0;
    documents.push(
      { _id: '1234', location: 'schlossstraße', district: 'steglitz' },
      { _id: '5678', location: 'bergmannstrasse', district: 'kreuzberg' }
    );

    await testCollectionViewProvider.provideTextDocumentContent(
      secondCollectionUri
    );
    codeLenses = testCodeLensProvider.provideCodeLenses();

    assert(!!codeLenses);
    assert(codeLenses.length === 2);

    firstCodeLensRange = codeLenses[0].range;
    firstExpectedStartLine = 2;

    assert(
      firstCodeLensRange.start.line === firstExpectedStartLine,
      `Expected a codeLens position to be at line ${firstExpectedStartLine}, found ${firstCodeLensRange.start.line}`
    );
    assert(codeLenses[0].command?.title === 'Edit Document');

    const secondCollectionFirstCommandArguments =
      codeLenses[0].command?.arguments;

    assert(!!secondCollectionFirstCommandArguments);
    assert(
      secondCollectionFirstCommandArguments[0].source ===
        DocumentSource.DOCUMENT_SOURCE_COLLECTIONVIEW
    );
    assert(
      secondCollectionFirstCommandArguments[0].namespace ===
        secondCollectionNamespace
    );
    assert(
      secondCollectionFirstCommandArguments[0].connectionId ===
        secondConnectionId
    );
    assert(secondCollectionFirstCommandArguments[0].documentId === '1234');

    const secondCodeLensRange = codeLenses[1].range;
    const secondExpectedStartLine = 7;

    assert(
      secondCodeLensRange.start.line === secondExpectedStartLine,
      `Expected a codeLens position to be at line ${secondExpectedStartLine}, found ${secondCodeLensRange.start.line}`
    );
    assert(codeLenses[0].command?.title === 'Edit Document');

    const secondCollectionSecondCommandArguments =
      codeLenses[1].command?.arguments;

    assert(!!secondCollectionSecondCommandArguments);
    assert(secondCollectionSecondCommandArguments[0].documentId === '5678');

    codeLensesInfo = testCodeLensProvider._codeLensesInfo;

    assert(Object.keys(codeLensesInfo).length === 2);

    firstCollectionCodeLensesInfo =
      testCodeLensProvider._codeLensesInfo[firstCollectionUri.toString()];

    assert(
      firstCollectionCodeLensesInfo[0].documentId === '5ea8745ee4811fafe8b65ecb'
    );

    const secondCollectionCodeLensesInfo =
      testCodeLensProvider._codeLensesInfo[secondCollectionUri.toString()];

    assert(!!secondCollectionCodeLensesInfo);
    assert(secondCollectionCodeLensesInfo[0].documentId === '1234');
  });
});
