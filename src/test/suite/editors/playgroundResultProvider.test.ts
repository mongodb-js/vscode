import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';

import ConnectionController from '../../../connectionController';
import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';
import CollectionDocumentsProvider, { VIEW_COLLECTION_SCHEME } from '../../../editors/collectionDocumentsProvider';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { TestExtensionContext } from '../stubs';

const expect = chai.expect;

suite('Playground Result Provider Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryService = new TelemetryService(
    mockStorageController,
    mockExtensionContext
  );
  const testStatusView = new StatusView(mockExtensionContext);
  const testConnectionController = new ConnectionController(
    testStatusView,
    mockStorageController,
    testTelemetryService
  );
  const testEditDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
    testConnectionController
  );
  const sandbox: any = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  test('constructor sets default playground result', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );

    expect(testPlaygroundResultViewProvider._playgroundResult).to.be.deep.equal(
      {
        namespace: null,
        type: null,
        content: undefined,
        language: null
      }
    );
  });

  test('setPlaygroundResult refreshes private playground result property', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Cursor',
      content: {
        _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        name: 'Berlin'
      },
      language: 'json'
    };

    testPlaygroundResultViewProvider.setPlaygroundResult(playgroundResult);

    expect(testPlaygroundResultViewProvider._playgroundResult).to.be.deep.equal(
      playgroundResult
    );
  });

  test('provideTextDocumentContent returns undefined formatted to string if content is undefined', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'undefined',
      content: null,
      language: 'plaintext'
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('undefined');
  });

  test('provideTextDocumentContent returns null formatted to string if content is null', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: null,
      language: 'plaintext'
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('null');
  });

  test('provideTextDocumentContent returns number formatted to string if content is number', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'number',
      content: 4,
      language: 'plaintext'
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('4');
  });

  test('provideTextDocumentContent returns array formatted to string if content is array', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: [],
      language: 'json'
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('[]');
  });

  test('provideTextDocumentContent returns object formatted to string if content is object', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: {},
      language: 'json'
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('{}');
  });

  test('provideTextDocumentContent returns boolean formatted to string if content is boolean', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'boolean',
      content: true,
      language: 'plaintext'
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('true');
  });

  test('provideTextDocumentContent returns string if content is string', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );

    testPlaygroundResultViewProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'string',
      content: 'Berlin',
      language: 'plaintext'
    };

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();

    expect(result).to.be.equal('Berlin');
  });

  test('provideTextDocumentContent returns Cursor formatted to string if content is string', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    const content = [
      {
        _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        name: 'Berlin'
      },
      {
        _id: '55333a0d-83f6-4e6f-a575-af7ea6187a55',
        name: 'Rome'
      }
    ];
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Cursor',
      content,
      language: 'json'
    };

    const mockRefresh: any = sinon.fake();
    sinon.replace(
      testPlaygroundResultViewProvider._editDocumentCodeLensProvider,
      'updateCodeLensesForPlayground',
      mockRefresh
    );

    testPlaygroundResultViewProvider._playgroundResult = playgroundResult;

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();
    mockRefresh.firstArg;

    expect(result).to.be.equal(JSON.stringify(content, null, 2));
    expect(mockRefresh.firstArg).to.be.deep.equal(playgroundResult);
  });

  test('provideTextDocumentContent returns Document formatted to string if content is string', () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    const content = {
      _id: '20213a0d-83f6-4e6f-a575-af7ea6187lala',
      name: 'Minsk'
    };
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Document',
      content,
      language: 'json'
    };

    const mockRefresh: any = sinon.fake();
    sinon.replace(
      testPlaygroundResultViewProvider._editDocumentCodeLensProvider,
      'updateCodeLensesForPlayground',
      mockRefresh
    );

    testPlaygroundResultViewProvider._playgroundResult = playgroundResult;

    const result = testPlaygroundResultViewProvider.provideTextDocumentContent();
    mockRefresh.firstArg;

    expect(result).to.be.equal(JSON.stringify(content, null, 2));
    expect(mockRefresh.firstArg).to.be.deep.equal(playgroundResult);
  });

  test('provideTextDocumentContent sets different code lenses for the playground and the collection', async () => {
    const testPlaygroundResultViewProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    const playgroundNamespace = 'db.berlin';
    const playgroundResult = {
      namespace: playgroundNamespace,
      type: 'Cursor',
      content: [
        { _id: 1, item: 'abc', price: 10, quantity: 2, date: new Date('2014-03-01T08:00:00Z') },
        { _id: 2, item: 'jkl', price: 20, quantity: 1, date: new Date('2014-03-01T09:00:00Z') }
      ],
      language: 'json'
    };

    const connectionId = '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487';
    const mockActiveConnectionId: any = sinon.fake.returns(connectionId);
    sinon.replace(
      testConnectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const playgroundResultUri = vscode.Uri.parse('PLAYGROUND_RESULT_SCHEME:/Playground Result');
    const activeTextEditorDocument = { uri: playgroundResultUri };
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: activeTextEditorDocument
    }));

    testPlaygroundResultViewProvider.setPlaygroundResult(playgroundResult);
    testPlaygroundResultViewProvider.provideTextDocumentContent();

    let codeLenses = testPlaygroundResultViewProvider._editDocumentCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(2);

    let firstCodeLensRange = codeLenses[0].range;

    expect(firstCodeLensRange.start.line).to.be.equal(2);
    expect(codeLenses[0].command?.title).to.be.equal('Edit Document');

    const secondCodeLensRange = codeLenses[1].range;

    expect(secondCodeLensRange.start.line).to.be.equal(9);

    let codeLensesInfo = testPlaygroundResultViewProvider
      ._editDocumentCodeLensProvider._codeLensesInfo;

    expect(Object.keys(codeLensesInfo).length).to.be.equal(1);

    let firstCodeLensesInfo = codeLensesInfo[playgroundResultUri.toString()];

    expect(firstCodeLensesInfo.length).to.be.equal(2);
    expect(firstCodeLensesInfo[0].documentId).to.be.equal(1);
    expect(firstCodeLensesInfo[0].source).to.be.equal('playground');
    expect(firstCodeLensesInfo[0].line).to.be.equal(2);
    expect(firstCodeLensesInfo[0].namespace).to.be.equal(playgroundNamespace);
    expect(firstCodeLensesInfo[0].connectionId).to.be.equal('1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487');

    expect(firstCodeLensesInfo[1].documentId).to.be.equal(2);
    expect(firstCodeLensesInfo[1].source).to.be.equal('playground');
    expect(firstCodeLensesInfo[1].line).to.be.equal(9);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockExtensionContext,
      testConnectionController,
      testQueryStore,
      testStatusView,
      testEditDocumentCodeLensProvider
    );

    testCollectionViewProvider._operationsStore = new CollectionDocumentsOperationsStore();

    const documents: any[] = [ { _id: '5ea8745ee4811fafe8b65ecb', koko: 'nothing5' } ];
    const mockGetActiveDataService: any = sinon.fake.returns({
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

    const mockShowMessage: any = sinon.fake();
    sinon.replace(testCollectionViewProvider._statusView, 'showMessage', mockShowMessage);

    const mockHideMessage: any = sinon.fake();
    sinon.replace(testCollectionViewProvider._statusView, 'hideMessage', mockHideMessage);

    const operationId = testCollectionViewProvider._operationsStore.createNewOperation();
    const collectionNamespace = 'berlin.cocktailbars';
    const collectionQuery = [
      `namespace=${collectionNamespace}`,
      `connectionId=${connectionId}`,
      `operationId=${operationId}`
    ].join('&');
    const collectionUri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${collectionNamespace}.json?${collectionQuery}`
    );

    activeTextEditorDocument.uri = collectionUri; // Switch active editor.
    await testCollectionViewProvider.provideTextDocumentContent(collectionUri);
    testPlaygroundResultViewProvider._editDocumentCodeLensProvider.provideCodeLenses();
    codeLenses = testPlaygroundResultViewProvider._editDocumentCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(1);

    firstCodeLensRange = codeLenses[0].range;

    expect(firstCodeLensRange.start.line).to.be.equal(2);
    expect(codeLenses[0].command?.title).to.be.equal('Edit Document');

    codeLensesInfo = testPlaygroundResultViewProvider._editDocumentCodeLensProvider._codeLensesInfo;

    expect(Object.keys(codeLensesInfo).length).to.be.equal(2);

    firstCodeLensesInfo = codeLensesInfo[playgroundResultUri.toString()];

    expect(firstCodeLensesInfo.length).to.be.equal(2);
    expect(firstCodeLensesInfo[0].documentId).to.be.equal(1);
    expect(firstCodeLensesInfo[0].source).to.be.equal('playground');
    expect(firstCodeLensesInfo[0].line).to.be.equal(2);
    expect(firstCodeLensesInfo[0].namespace).to.be.equal(playgroundNamespace);
    expect(firstCodeLensesInfo[0].connectionId).to.be.equal('1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487');

    expect(firstCodeLensesInfo[1].documentId).to.be.equal(2);
    expect(firstCodeLensesInfo[1].source).to.be.equal('playground');
    expect(firstCodeLensesInfo[1].line).to.be.equal(9);

    const secondCodeLensesInfo = codeLensesInfo[collectionUri.toString()];

    expect(secondCodeLensesInfo.length).to.be.equal(1);
    expect(secondCodeLensesInfo[0].documentId).to.be.equal('5ea8745ee4811fafe8b65ecb');
    expect(secondCodeLensesInfo[0].source).to.be.equal('collectionview');
    expect(secondCodeLensesInfo[0].line).to.be.equal(2);
    expect(secondCodeLensesInfo[0].namespace).to.be.equal(collectionNamespace);
    expect(secondCodeLensesInfo[0].connectionId).to.be.equal('1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487');
  });
});
