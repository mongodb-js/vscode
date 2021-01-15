import * as vscode from 'vscode';

import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { TestExtensionContext } from '../stubs';
import { afterEach } from 'mocha';
import ConnectionController from '../../../connectionController';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { StatusView } from '../../../views';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import CollectionDocumentsProvider, { VIEW_COLLECTION_SCHEME } from '../../../editors/collectionDocumentsProvider';
import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';

const sinon = require('sinon');
const chai = require('chai');
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

  afterEach(() => {
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
        content: undefined
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
      }
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
      content: null
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
      content: null
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
      content: 4
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
      content: []
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
      content: {}
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
      content: true
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
      content: 'Berlin'
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
      content
    };

    const mockRefresh = sinon.fake.resolves();
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
      content
    };

    const mockRefresh = sinon.fake.resolves();
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

  test('provideTextDocumentContent differentiates code lenses providers for playgrounds and collections', async () => {
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
      ]
    };

    const connectionId = '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487';
    const mockActiveConnectionId = sinon.fake.returns(connectionId);
    sinon.replace(
      testConnectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    testPlaygroundResultViewProvider.setPlaygroundResult(playgroundResult);
    testPlaygroundResultViewProvider.provideTextDocumentContent();

    const firstPlaygroundCodeLensesInfo = testPlaygroundResultViewProvider._editDocumentCodeLensProvider._codeLensesInfo;

    expect(firstPlaygroundCodeLensesInfo.length).to.be.equal(2);
    expect(firstPlaygroundCodeLensesInfo[0].documentId).to.be.equal(1);
    expect(firstPlaygroundCodeLensesInfo[0].source).to.be.equal('playground');
    expect(firstPlaygroundCodeLensesInfo[0].line).to.be.equal(2);
    expect(firstPlaygroundCodeLensesInfo[0].namespace).to.be.equal(playgroundNamespace);
    expect(firstPlaygroundCodeLensesInfo[0].connectionId).to.be.equal('1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487');

    expect(firstPlaygroundCodeLensesInfo[1].documentId).to.be.equal(2);
    expect(firstPlaygroundCodeLensesInfo[1].source).to.be.equal('playground');
    expect(firstPlaygroundCodeLensesInfo[1].line).to.be.equal(9);

    /* const editDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );

    mockExtensionContext.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        {
          scheme: VIEW_COLLECTION_SCHEME,
          language: 'json',
          pattern: 'Results: berlin.cocktailbars.json'
        },
        editDocumentCodeLensProvider
      )
    );

    editDocumentCodeLensProvider.updateCodeLensesForCollection({
      content: [ { _id: '5ea8745ee4811fafe8b65ecb', koko: 'nothing5' } ],
      namespace: 'berlin.cocktailbars'
    }); */

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockExtensionContext,
      testConnectionController,
      testQueryStore,
      testStatusView
    );

    testCollectionViewProvider._operationsStore = new CollectionDocumentsOperationsStore();

    const mockRegisterCodeLensProvider: any = sinon.fake.resolves([]);
    sinon.replace(vscode.languages, 'registerCodeLensProvider', mockRegisterCodeLensProvider);

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

    expect(mockRegisterCodeLensProvider.firstArg).to.be.deep.equal({
      scheme: 'VIEW_COLLECTION_SCHEME',
      language: 'json',
      pattern: 'Results: berlin.cocktailbars.json'
    });
    expect(mockRegisterCodeLensProvider.lastArg._codeLensesInfo).to.be.deep.equal([
      {
        documentId: '5ea8745ee4811fafe8b65ecb',
        source: 'treeview',
        line: 2,
        namespace: 'berlin.cocktailbars',
        connectionId: '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487'
      }
    ]);

    const secondPlaygroundCodeLensesInfo = testPlaygroundResultViewProvider
      ._editDocumentCodeLensProvider._codeLensesInfo;

    expect(secondPlaygroundCodeLensesInfo.length).to.be.equal(2);
    expect(secondPlaygroundCodeLensesInfo[1].documentId).to.be.equal(2);
    expect(secondPlaygroundCodeLensesInfo[1].source).to.be.equal('playground');
    expect(secondPlaygroundCodeLensesInfo[1].line).to.be.equal(9);
  });
});
