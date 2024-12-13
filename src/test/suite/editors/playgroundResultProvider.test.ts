import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';
import type { Document } from 'mongodb';

import ConnectionController from '../../../connectionController';
import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';
import CollectionDocumentsProvider, {
  VIEW_COLLECTION_SCHEME,
} from '../../../editors/collectionDocumentsProvider';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { ExtensionContextStub } from '../stubs';

const expect = chai.expect;

suite('Playground Result Provider Test Suite', () => {
  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
  );
  const testStatusView = new StatusView(extensionContextStub);
  const testConnectionController = new ConnectionController({
    statusView: testStatusView,
    storageController: testStorageController,
    telemetryService: testTelemetryService,
  });
  const testEditDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
    testConnectionController
  );
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('setPlaygroundResult refreshes private playground result property', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Cursor',
      content: {
        _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        name: 'Berlin',
      },
      language: 'json',
    };
    testPlaygroundResultProvider.setPlaygroundResult(playgroundResult);
    expect(testPlaygroundResultProvider._playgroundResult).to.be.deep.equal(
      playgroundResult
    );
  });

  test('provideTextDocumentContent returns undefined formatted to string if content is undefined', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testPlaygroundResultProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'undefined',
      content: null,
      language: 'plaintext',
    };

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal('undefined');
  });

  test('provideTextDocumentContent returns null formatted to string if content is null', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testPlaygroundResultProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: null,
      language: 'plaintext',
    };

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal('null');
  });

  test('provideTextDocumentContent returns number formatted to string if content is number', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testPlaygroundResultProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'number',
      content: 4,
      language: 'plaintext',
    };

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal('4');
  });

  test('provideTextDocumentContent returns array formatted to string if content is array', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testPlaygroundResultProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: [],
      language: 'json',
    };

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal('[]');
  });

  test('provideTextDocumentContent returns object formatted to string if content is object', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testPlaygroundResultProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'object',
      content: {},
      language: 'json',
    };

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal('{}');
  });

  test('provideTextDocumentContent returns boolean formatted to string if content is boolean', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testPlaygroundResultProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'boolean',
      content: true,
      language: 'plaintext',
    };

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal('true');
  });

  test('provideTextDocumentContent returns string if content is string', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testPlaygroundResultProvider._playgroundResult = {
      namespace: 'db.berlin',
      type: 'string',
      content: 'Berlin',
      language: 'plaintext',
    };

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal('Berlin');
  });

  test('provideTextDocumentContent returns Cursor formatted to string if content is string', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    const content = [
      {
        _id: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        name: 'Berlin',
      },
      {
        _id: '55333a0d-83f6-4e6f-a575-af7ea6187a55',
        name: 'Rome',
      },
    ];
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Cursor',
      content,
      language: 'json',
    };

    const fakeUpdateCodeLensesForPlayground = sandbox.fake();
    sandbox.replace(
      testPlaygroundResultProvider._editDocumentCodeLensProvider,
      'updateCodeLensesForPlayground',
      fakeUpdateCodeLensesForPlayground
    );

    testPlaygroundResultProvider._playgroundResult = playgroundResult;

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal(JSON.stringify(content, null, 2));
    expect(fakeUpdateCodeLensesForPlayground.calledOnce).to.equal(true);
    expect(
      fakeUpdateCodeLensesForPlayground.firstCall.firstArg
    ).to.be.deep.equal(playgroundResult);
  });

  test('provideTextDocumentContent returns Document formatted to string if content is string', () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    const content = {
      _id: '20213a0d-83f6-4e6f-a575-af7ea6187lala',
      name: 'Minsk',
    };
    const playgroundResult = {
      namespace: 'db.berlin',
      type: 'Document',
      content,
      language: 'json',
    };

    const fakeUpdateCodeLensesForPlayground = sandbox.fake();
    sandbox.replace(
      testPlaygroundResultProvider._editDocumentCodeLensProvider,
      'updateCodeLensesForPlayground',
      fakeUpdateCodeLensesForPlayground
    );

    testPlaygroundResultProvider._playgroundResult = playgroundResult;

    const result = testPlaygroundResultProvider.provideTextDocumentContent();
    expect(result).to.be.equal(JSON.stringify(content, null, 2));
    expect(fakeUpdateCodeLensesForPlayground.calledOnce).to.equal(true);
    expect(
      fakeUpdateCodeLensesForPlayground.firstCall.firstArg
    ).to.be.deep.equal(playgroundResult);
  });

  test('provideTextDocumentContent sets different code lenses for the playground and the collection', async () => {
    const testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    const playgroundNamespace = 'db.berlin';
    const playgroundResult = {
      namespace: playgroundNamespace,
      type: 'Cursor',
      content: [
        {
          _id: 1,
          item: 'abc',
          price: 10,
          quantity: 2,
          date: new Date('2014-03-01T08:00:00Z'),
        },
        {
          _id: 2,
          item: 'jkl',
          price: 20,
          quantity: 1,
          date: new Date('2014-03-01T09:00:00Z'),
        },
      ],
      language: 'json',
    };

    const connectionId = '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487';
    const fakeActiveConnectionId = sandbox.fake.returns(connectionId);
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId
    );

    const playgroundResultUri = vscode.Uri.parse(
      'PLAYGROUND_RESULT_SCHEME:/Playground Result'
    );
    const activeTextEditorDocument = { uri: playgroundResultUri };
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () =>
        ({
          document: activeTextEditorDocument,
        } as unknown as typeof vscode.window.activeTextEditor)
    );

    testPlaygroundResultProvider.setPlaygroundResult(playgroundResult);
    testPlaygroundResultProvider.provideTextDocumentContent();

    let codeLenses =
      testPlaygroundResultProvider._editDocumentCodeLensProvider.provideCodeLenses();
    expect(codeLenses.length).to.be.equal(2);

    let firstCodeLensRange = codeLenses[0].range;
    expect(firstCodeLensRange.start.line).to.be.equal(2);
    expect(codeLenses[0].command?.title).to.be.equal('Edit Document');

    const secondCodeLensRange = codeLenses[1].range;
    expect(secondCodeLensRange.start.line).to.be.equal(9);

    let codeLensesInfo =
      testPlaygroundResultProvider._editDocumentCodeLensProvider
        ._codeLensesInfo;
    expect(Object.keys(codeLensesInfo).length).to.be.equal(1);

    let firstCodeLensesInfo = codeLensesInfo[playgroundResultUri.toString()];
    expect(firstCodeLensesInfo.length).to.be.equal(2);
    expect(firstCodeLensesInfo[0].documentId).to.be.equal(1);
    expect(firstCodeLensesInfo[0].source).to.be.equal('playground');
    expect(firstCodeLensesInfo[0].line).to.be.equal(2);
    expect(firstCodeLensesInfo[0].namespace).to.be.equal(playgroundNamespace);
    expect(firstCodeLensesInfo[0].connectionId).to.be.equal(
      '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487'
    );

    expect(firstCodeLensesInfo[1].documentId).to.be.equal(2);
    expect(firstCodeLensesInfo[1].source).to.be.equal('playground');
    expect(firstCodeLensesInfo[1].line).to.be.equal(9);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider({
      context: extensionContextStub,
      connectionController: testConnectionController,
      operationsStore: testQueryStore,
      statusView: testStatusView,
      editDocumentCodeLensProvider: testEditDocumentCodeLensProvider,
    });

    testCollectionViewProvider._operationsStore =
      new CollectionDocumentsOperationsStore();

    const documents: Document[] = [
      { _id: '5ea8745ee4811fafe8b65ecb', koko: 'nothing5' },
    ];
    sinon
      .stub(
        testCollectionViewProvider._connectionController,
        'getActiveDataService'
      )
      .returns({
        find: () => {
          return Promise.resolve(documents);
        },
      } as unknown as DataService);

    sandbox.stub(testCollectionViewProvider._statusView, 'showMessage');
    sandbox.stub(testCollectionViewProvider._statusView, 'hideMessage');

    const operationId =
      testCollectionViewProvider._operationsStore.createNewOperation();
    const collectionNamespace = 'berlin.cocktailbars';
    const collectionQuery = [
      `namespace=${collectionNamespace}`,
      `connectionId=${connectionId}`,
      `operationId=${operationId}`,
    ].join('&');
    const collectionUri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${collectionNamespace}.mongodb.json?${collectionQuery}`
    );

    activeTextEditorDocument.uri = collectionUri; // Switch active editor.
    await testCollectionViewProvider.provideTextDocumentContent(collectionUri);
    testPlaygroundResultProvider._editDocumentCodeLensProvider.provideCodeLenses();
    codeLenses =
      testPlaygroundResultProvider._editDocumentCodeLensProvider.provideCodeLenses();

    expect(codeLenses.length).to.be.equal(1);

    firstCodeLensRange = codeLenses[0].range;

    expect(firstCodeLensRange.start.line).to.be.equal(2);
    expect(codeLenses[0].command?.title).to.be.equal('Edit Document');

    codeLensesInfo =
      testPlaygroundResultProvider._editDocumentCodeLensProvider
        ._codeLensesInfo;

    expect(Object.keys(codeLensesInfo).length).to.be.equal(2);

    firstCodeLensesInfo = codeLensesInfo[playgroundResultUri.toString()];

    expect(firstCodeLensesInfo.length).to.be.equal(2);
    expect(firstCodeLensesInfo[0].documentId).to.be.equal(1);
    expect(firstCodeLensesInfo[0].source).to.be.equal('playground');
    expect(firstCodeLensesInfo[0].line).to.be.equal(2);
    expect(firstCodeLensesInfo[0].namespace).to.be.equal(playgroundNamespace);
    expect(firstCodeLensesInfo[0].connectionId).to.be.equal(
      '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487'
    );

    expect(firstCodeLensesInfo[1].documentId).to.be.equal(2);
    expect(firstCodeLensesInfo[1].source).to.be.equal('playground');
    expect(firstCodeLensesInfo[1].line).to.be.equal(9);

    const secondCodeLensesInfo = codeLensesInfo[collectionUri.toString()];
    expect(secondCodeLensesInfo.length).to.be.equal(1);
    expect(secondCodeLensesInfo[0].documentId).to.be.equal(
      '5ea8745ee4811fafe8b65ecb'
    );
    expect(secondCodeLensesInfo[0].source).to.be.equal('collectionview');
    expect(secondCodeLensesInfo[0].line).to.be.equal(2);
    expect(secondCodeLensesInfo[0].namespace).to.be.equal(collectionNamespace);
    expect(secondCodeLensesInfo[0].connectionId).to.be.equal(
      '1c8c2b06-fbfb-40b7-bd8a-bd1f8333a487'
    );
  });
});
