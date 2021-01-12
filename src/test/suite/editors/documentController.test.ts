import * as vscode from 'vscode';
import MongoDBDocumentService from '../../../editors/mongoDBDocumentService';
import DocumentIdStore from '../../../editors/documentIdStore';
import ConnectionController from '../../../connectionController';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';
import { StatusView } from '../../../views';
import TelemetryController from '../../../telemetry/telemetryController';
import { afterEach } from 'mocha';
import { EJSON } from 'bson';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

suite('MongoDB Document Service Test Suite', () => {
  const testDocumentIdStore = new DocumentIdStore();
  const mockExtensionContext = new TestExtensionContext();
  const testStorageController = new StorageController(mockExtensionContext);
  const testStatusView = new StatusView(mockExtensionContext);
  const testTelemetryController = new TelemetryController(
    testStorageController,
    mockExtensionContext
  );
  const testConnectionController = new ConnectionController(
    testStatusView,
    testStorageController,
    testTelemetryController
  );
  const testMongoDBDocumentService = new MongoDBDocumentService(
    mockExtensionContext,
    testDocumentIdStore,
    testConnectionController,
    testStatusView,
    testTelemetryController
  );

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  test('replaceDocument calls findOneAndReplace and saves a document when connected', async () => {
    const namespace = 'waffle.house';
    const connectionId = 'tasty_sandwhich';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const document: EJSON.SerializableTypes = { _id: '123' };
    const newDocument = { _id: '123', price: 5000 };

    const mockActiveConnectionId = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      testConnectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const mockGetActiveDataService = sinon.fake.returns({
      findOneAndReplace: async (
        namespace: string,
        filter: object,
        replacement: object,
        options: object,
        callback: (error: Error | null, result: object) => void
      // eslint-disable-next-line @typescript-eslint/require-await
      ) => {
        document.price = 5000;

        return callback(null, document);
      }
    });
    sinon.replace(
      testConnectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );

    const mockShowMessage = sinon.fake();
    sinon.replace(testStatusView, 'showMessage', mockShowMessage);

    const mockHideMessage = sinon.fake();
    sinon.replace(testStatusView, 'hideMessage', mockHideMessage);

    await testMongoDBDocumentService.replaceDocument({
      namespace,
      documentId,
      connectionId,
      newDocument
    });

    expect(document).to.be.deep.equal(newDocument);
  });

  test('fetchDocument calls find and returns a single document when connected', async () => {
    const namespace = 'waffle.house';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const documents = [{ _id: '123' }];

    const mockGetActiveDataService = sinon.fake.returns({
      find: (
        namespace: string,
        filter: object,
        options: object,
        callback: (error: Error | null, result: object) => void
      ) => {
        return callback(null, [{ _id: '123' }]);
      }
    });
    sinon.replace(
      testConnectionController,
      'getActiveDataService',
      mockGetActiveDataService
    );

    const mockShowMessage = sinon.fake();
    sinon.replace(testStatusView, 'showMessage', mockShowMessage);

    const mockHideMessage = sinon.fake();
    sinon.replace(testStatusView, 'hideMessage', mockHideMessage);

    const result = await testMongoDBDocumentService.fetchDocument({
      namespace,
      documentId
    });

    expect(result).to.be.deep.equal(JSON.parse(EJSON.stringify(documents[0])));
  });

  test("if a user is not connected, documents won't be saved to MongoDB", async () => {
    const namespace = 'waffle.house';
    const connectionId = 'tasty_sandwhich';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const newDocument = { _id: '123', price: 5000 };

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const mockActiveConnectionId = sinon.fake.returns(null);
    sinon.replace(
      testConnectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const mockGetSavedConnectionName = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      testConnectionController,
      'getSavedConnectionName',
      mockGetSavedConnectionName
    );

    try {
      await testMongoDBDocumentService.replaceDocument({
        documentId,
        namespace,
        connectionId,
        newDocument
      });
    } catch (error) {
      const expectedMessage =
        "Unable to save document: no longer connected to 'tasty_sandwhich'";

      expect(error.message).to.be.equal(expectedMessage);
    }
  });

  test("if a user switched the active connection, document opened from the previous connection can't be saved", async () => {
    const namespace = 'waffle.house';
    const connectionId = 'tasty_sandwhich';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const newDocument = { _id: '123', price: 5000 };

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const mockActiveConnectionId = sinon.fake.returns('berlin.coctails');
    sinon.replace(
      testConnectionController,
      'getActiveConnectionId',
      mockActiveConnectionId
    );

    const mockGetSavedConnectionName = sinon.fake.returns('tasty_sandwhich');
    sinon.replace(
      testConnectionController,
      'getSavedConnectionName',
      mockGetSavedConnectionName
    );

    try {
      await testMongoDBDocumentService.replaceDocument({
        documentId,
        namespace,
        connectionId,
        newDocument
      });
    } catch (error) {
      const expectedMessage =
        "Unable to save document: no longer connected to 'tasty_sandwhich'";

      expect(error.message).to.be.equal(expectedMessage);
    }
  });
});
