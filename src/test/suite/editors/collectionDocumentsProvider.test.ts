import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';

import CollectionDocumentsProvider from '../../../editors/collectionDocumentsProvider';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';
import CollectionDocumentsOperationsStore from '../../../editors/collectionDocumentsOperationsStore';

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
  afterEach(function () {
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

    const mockExtensionContext = new TestExtensionContext();
    const mockStorageController = new StorageController(mockExtensionContext);
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockConnectionController,
      testQueryStore,
      new StatusView(mockExtensionContext)
    );

    const operationId = testQueryStore.createNewOperation();

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=my-favorite-fruit-is.pineapple&operationId=${operationId}`
    );

    testCollectionViewProvider.provideTextDocumentContent(uri).then(documents => {
      assert(
        documents.includes('Declaration of Independence'),
        `Expected provideTextDocumentContent to return documents string, found ${documents}`
      );
      done();
    }).catch(done);
  });

  test('expected provideTextDocumentContent to return a ejson.stringify string', (done) => {
    const mockDocuments = [{
      _id: 'first_id',
      field1: 'first_field'
    }, {
      _id: 'first_id',
      field1: 'first_field'
    }];

    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, mockDocuments);
      }
    };

    const mockExtensionContext = new TestExtensionContext();
    const mockStorageController = new StorageController(mockExtensionContext);
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockConnectionController,
      testQueryStore,
      new StatusView(mockExtensionContext)
    );

    const operationId = testQueryStore.createNewOperation();

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=test.test&operationId=${operationId}`
    );

    testCollectionViewProvider.provideTextDocumentContent(uri).then(documents => {
      assert(
        documents === mockDocumentsAsJsonString,
        `Expected provideTextDocumentContent to return ejson stringified string, found ${documents}`
      );
      done();
    }).catch(done);
  });

  test('expected provideTextDocumentContent to set hasMoreDocumentsToShow to false when there arent more documents', (done) => {
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, ['Apollo', 'Gemini ']);
      }
    };

    const mockExtensionContext = new TestExtensionContext();
    const mockStorageController = new StorageController(mockExtensionContext);
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
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
      assert(testQueryStore.operations[operationId].hasMoreDocumentsToShow === false, 'Expected not to have more documents to show.');

      // Reset and test inverse.
      testQueryStore.operations[operationId].currentLimit = 2;
      testQueryStore.operations[operationId].hasMoreDocumentsToShow = true;

      testCollectionViewProvider.provideTextDocumentContent(uri).then(() => {
        assert(testQueryStore.operations[operationId].hasMoreDocumentsToShow);

        done();
      }).catch(done);
    });
  });

  test('provideTextDocumentContent shows a status bar item while it is running then hide it', (done) => {
    const mockActiveConnection = { find: {} };

    const mockExtensionContext = new TestExtensionContext();
    const mockStorageController = new StorageController(mockExtensionContext);
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const textStatusView = new StatusView(mockExtensionContext);

    const testQueryStore = new CollectionDocumentsOperationsStore();
    const testCollectionViewProvider = new CollectionDocumentsProvider(
      mockConnectionController,
      testQueryStore,
      textStatusView
    );

    const operationId = testQueryStore.createNewOperation();

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=aaaaaaaa&operationId=${operationId}`
    );

    const mockShowMessage = sinon.fake();
    sinon.replace(textStatusView, 'showMessage', mockShowMessage);

    const mockHideMessage = sinon.fake();
    sinon.replace(textStatusView, 'hideMessage', mockHideMessage);

    mockActiveConnection.find = (namespace, filter, options, callback): void => {
      assert(mockShowMessage.called);
      assert(!mockHideMessage.called);
      assert(mockShowMessage.firstArg === 'Fetching documents...');

      return callback(null, ['aaaaaaaaaaaaaaaaa']);
    };

    testCollectionViewProvider.provideTextDocumentContent(uri).then(() => {
      assert(mockHideMessage.called);
    }).then(done, done);
  });
});
