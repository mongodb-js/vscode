import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';
import { ObjectId, EJSON } from 'bson';

import DocumentProvider from '../../../editors/documentProvider';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';
import {
  seedDataAndCreateDataService,
  cleanupTestDB,
  TEST_DB_NAME
} from '../dbTestHelper';

const mockDocumentAsJsonString = `{
  "_id": "first_id",
  "field1": "first_field"
}`;

const docAsString2 = `{
  "_id": "5e32b4d67bf47f4525f2f8ab",
  "bowl": "noodles"
}`;

const docAsString3 = `{
  "_id": 15,
  "bowl": "noodles"
}`;

suite('Document Provider Test Suite', () => {
  afterEach(() => {
    sinon.restore();
  });

  test('expected provideTextDocumentContent to parse uri and return the document in the form of a string from a find call', (done) => {
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        assert(
          namespace === 'fruit.pineapple',
          `Expected find namespace to be 'fruit.pineapple' found ${namespace}`
        );

        assert(
          options.limit === 1,
          `Expected find limit to be 1, found ${options.limit}`
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

    const testCollectionViewProvider = new DocumentProvider(
      mockConnectionController,
      new StatusView(mockExtensionContext)
    );

    const documentId = EJSON.stringify({
      value: '123'
    });

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=fruit.pineapple&documentId=${documentId}`
    );

    testCollectionViewProvider.provideTextDocumentContent(uri).then(document => {
      assert(
        document.includes('Declaration of Independence'),
        `Expected provideTextDocumentContent to return document string, found ${document}`
      );
      done();
    }).catch(done);
  });

  test('expected provideTextDocumentContent to return a json.stringify string', (done) => {
    const mockDocument = [{
      _id: 'first_id',
      field1: 'first_field'
    }];

    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, mockDocument);
      }
    };

    const mockExtensionContext = new TestExtensionContext();
    const mockStorageController = new StorageController(mockExtensionContext);
    const mockConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testCollectionViewProvider = new DocumentProvider(
      mockConnectionController,
      new StatusView(mockExtensionContext)
    );

    const documentId = EJSON.stringify({
      value: '123'
    });

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=test.test&documentId=${documentId}`
    );

    testCollectionViewProvider.provideTextDocumentContent(uri).then(document => {
      assert(
        document === mockDocumentAsJsonString,
        `Expected provideTextDocumentContent to return json stringified string, found ${document}`
      );
      done();
    }).catch(done);
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

    const testCollectionViewProvider = new DocumentProvider(
      mockConnectionController,
      textStatusView
    );

    const documentId = EJSON.stringify({
      value: '123'
    });

    const uri = vscode.Uri.parse(
      `scheme:Results: filename.json?namespace=aaaaaaaa&documentId=${documentId}`
    );

    const mockShowMessage = sinon.fake();
    sinon.replace(textStatusView, 'showMessage', mockShowMessage);

    const mockHideMessage = sinon.fake();
    sinon.replace(textStatusView, 'hideMessage', mockHideMessage);

    mockActiveConnection.find = (namespace, filter, options, callback): void => {
      assert(mockShowMessage.called);
      assert(!mockHideMessage.called);
      assert(mockShowMessage.firstArg === 'Fetching document...');

      return callback(null, ['aaaaaaaaaaaaaaaaa']);
    };

    testCollectionViewProvider.provideTextDocumentContent(uri).then(() => {
      assert(mockHideMessage.called);
    }).then(done, done);
  });

  suite('Document Provider with live database', () => {
    afterEach(async () => {
      await cleanupTestDB();
    });

    test('expected provideTextDocumentContent to handle an id that is an object id', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f8ab'),
        bowl: 'noodles'
      };

      seedDataAndCreateDataService('ramen', [
        mockDocument
      ]).then((dataService) => {
        const mockExtensionContext = new TestExtensionContext();
        const mockStorageController = new StorageController(mockExtensionContext);
        const mockConnectionController = new ConnectionController(
          new StatusView(mockExtensionContext),
          mockStorageController
        );
        mockConnectionController.setActiveConnection(dataService);

        const testCollectionViewProvider = new DocumentProvider(
          mockConnectionController,
          new StatusView(mockExtensionContext)
        );

        const documentId = EJSON.stringify({
          value: mockDocument._id
        });
        const uri = vscode.Uri.parse(
          `scheme:Results: filename.json?namespace=${TEST_DB_NAME}.ramen&documentId=${documentId}`
        );

        testCollectionViewProvider.provideTextDocumentContent(uri).then(document => {
          assert(
            document === docAsString2,
            `Expected provideTextDocumentContent to return json stringified string, found ${document}`
          );
          done();
        }).catch(done);
      });
    });

    test('expected provideTextDocumentContent to handle an id that is not an object id', (done) => {
      const mockDocument = {
        _id: 15,
        bowl: 'noodles'
      };

      seedDataAndCreateDataService('ramen', [
        mockDocument
      ]).then((dataService) => {
        const mockExtensionContext = new TestExtensionContext();
        const mockStorageController = new StorageController(mockExtensionContext);
        const mockConnectionController = new ConnectionController(
          new StatusView(mockExtensionContext),
          mockStorageController
        );
        mockConnectionController.setActiveConnection(dataService);

        const testCollectionViewProvider = new DocumentProvider(
          mockConnectionController,
          new StatusView(mockExtensionContext)
        );

        const documentId = EJSON.stringify({
          value: mockDocument._id
        });
        const uri = vscode.Uri.parse(
          `scheme:Results: filename.json?namespace=${TEST_DB_NAME}.ramen&documentId=${documentId}`
        );

        testCollectionViewProvider.provideTextDocumentContent(uri).then(document => {
          assert(
            document === docAsString3,
            `Expected provideTextDocumentContent to return json stringified string, found ${document}`
          );
          done();
        }).catch(done);
      });
    });
  });
});
