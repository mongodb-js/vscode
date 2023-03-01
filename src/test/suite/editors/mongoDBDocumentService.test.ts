import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import { EJSON } from 'bson';
import sinon from 'sinon';

import ConnectionController from '../../../connectionController';
import { DocumentSource } from '../../../documentSource';
import formatError from '../../../utils/formatError';
import MongoDBDocumentService from '../../../editors/mongoDBDocumentService';

import { StorageController } from '../../../storage';
import { StatusView } from '../../../views';
import TelemetryService from '../../../telemetry/telemetryService';
import { ExtensionContextStub } from '../stubs';

const expect = chai.expect;

suite('MongoDB Document Service Test Suite', () => {
  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testStatusView = new StatusView(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
  );
  const testConnectionController = new ConnectionController(
    testStatusView,
    testStorageController,
    testTelemetryService
  );
  const testMongoDBDocumentService = new MongoDBDocumentService(
    extensionContextStub,
    testConnectionController,
    testStatusView,
    testTelemetryService
  );

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  test('replaceDocument calls findOneAndReplace and saves a document when connected', async () => {
    const namespace = 'waffle.house';
    const connectionId = 'tasty_sandwhich';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const document: EJSON.SerializableTypes = { _id: '123' };
    const newDocument = { _id: '123', price: 5000 };
    const source = DocumentSource.DOCUMENT_SOURCE_TREEVIEW;

    const fakeActiveConnectionId = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId
    );

    const fakeGetActiveDataService = sandbox.fake.returns({
      findOneAndReplace: (
        namespace: string,
        filter: object,
        replacement: object,
        options: object,
        callback: (error: Error | null, result: object) => void
      ) => {
        document.price = 5000;

        return callback(null, document);
      },
    });
    sandbox.replace(
      testConnectionController,
      'getActiveDataService',
      fakeGetActiveDataService
    );
    sandbox.stub(testStatusView, 'showMessage');
    sandbox.stub(testStatusView, 'hideMessage');

    await testMongoDBDocumentService.replaceDocument({
      namespace,
      documentId,
      connectionId,
      newDocument,
      source,
    });

    expect(document).to.be.deep.equal(newDocument);
  });

  test('fetchDocument calls find and returns a single document when connected', async () => {
    const namespace = 'waffle.house';
    const connectionId = 'tasty_sandwhich';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const line = 1;
    const documents = [{ _id: '123' }];
    const source = DocumentSource.DOCUMENT_SOURCE_PLAYGROUND;

    const fakeGetActiveDataService = sandbox.fake.returns({
      find: () => {
        return Promise.resolve([{ _id: '123' }]);
      },
    });
    sandbox.replace(
      testConnectionController,
      'getActiveDataService',
      fakeGetActiveDataService
    );

    const fakeGetActiveConnectionId = sandbox.fake.returns(connectionId);
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeGetActiveConnectionId
    );

    sandbox.stub(testStatusView, 'showMessage');
    sandbox.stub(testStatusView, 'hideMessage');

    const result = await testMongoDBDocumentService.fetchDocument({
      namespace,
      documentId,
      line,
      connectionId,
      source,
    });

    expect(result).to.be.deep.equal(JSON.parse(EJSON.stringify(documents[0])));
  });

  test("if a user is not connected, documents won't be saved to MongoDB", async () => {
    const namespace = 'waffle.house';
    const connectionId = 'tasty_sandwhich';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const newDocument = { _id: '123', price: 5000 };
    const source = DocumentSource.DOCUMENT_SOURCE_TREEVIEW;

    const fakeActiveConnectionId = sandbox.fake.returns(null);
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId
    );

    const fakeGetSavedConnectionName = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getSavedConnectionName',
      fakeGetSavedConnectionName
    );

    try {
      await testMongoDBDocumentService.replaceDocument({
        documentId,
        namespace,
        connectionId,
        newDocument,
        source,
      });
    } catch (error) {
      const expectedMessage =
        "Unable to save document: no longer connected to 'tasty_sandwhich'";

      expect(formatError(error).message).to.be.equal(expectedMessage);
    }
  });

  test("if a user switched the active connection, document opened from the previous connection can't be saved", async () => {
    const namespace = 'waffle.house';
    const connectionId = 'tasty_sandwhich';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const newDocument = { _id: '123', price: 5000 };
    const source = DocumentSource.DOCUMENT_SOURCE_PLAYGROUND;

    const fakeActiveConnectionId = sandbox.fake.returns('berlin.coctails');
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId
    );

    const fakeGetSavedConnectionName = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getSavedConnectionName',
      fakeGetSavedConnectionName
    );

    try {
      await testMongoDBDocumentService.replaceDocument({
        documentId,
        namespace,
        connectionId,
        newDocument,
        source,
      });
    } catch (error) {
      const expectedMessage =
        "Unable to save document: no longer connected to 'tasty_sandwhich'";

      expect(formatError(error).message).to.be.equal(expectedMessage);
    }
  });

  test("if a user switched the active connection, document can't be opened from the old playground results", async () => {
    const namespace = 'waffle.house';
    const connectionId = '123';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const line = 1;
    const source = DocumentSource.DOCUMENT_SOURCE_PLAYGROUND;

    const fakeGetActiveConnectionId = sandbox.fake.returns('345');
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeGetActiveConnectionId
    );

    const fakeGetSavedConnectionName = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getSavedConnectionName',
      fakeGetSavedConnectionName
    );

    sandbox.stub(testStatusView, 'showMessage');
    sandbox.stub(testStatusView, 'hideMessage');

    try {
      await testMongoDBDocumentService.fetchDocument({
        namespace,
        documentId,
        line,
        connectionId,
        source,
      });
    } catch (error) {
      const expectedMessage =
        "Unable to fetch document: no longer connected to 'tasty_sandwhich'";

      expect(formatError(error).message).to.be.equal(expectedMessage);
    }
  });
});
