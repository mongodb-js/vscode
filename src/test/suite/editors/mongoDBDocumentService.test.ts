import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import { EJSON, Long, ObjectId } from 'bson';
import sinon from 'sinon';

import ConnectionController from '../../../connectionController';
import { DocumentSource } from '../../../documentSource';
import formatError from '../../../utils/formatError';
import MongoDBDocumentService from '../../../editors/mongoDBDocumentService';

import { StorageController } from '../../../storage';
import { StatusView } from '../../../views';
import { TelemetryService } from '../../../telemetry';
import { ExtensionContextStub } from '../stubs';

const expect = chai.expect;

const namespace = 'waffle.house';
const connectionId = 'tasty_sandwhich';
const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';

suite('MongoDB Document Service Test Suite', function () {
  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testStatusView = new StatusView(extensionContextStub);
  sinon.stub(testStatusView, 'showMessage');
  sinon.stub(testStatusView, 'hideMessage');
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub,
  );
  const testConnectionController = new ConnectionController({
    statusView: testStatusView,
    storageController: testStorageController,
    telemetryService: testTelemetryService,
  });
  const testMongoDBDocumentService = new MongoDBDocumentService({
    context: extensionContextStub,
    connectionController: testConnectionController,
    statusView: testStatusView,
    telemetryService: testTelemetryService,
  });

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  test('replaceDocument calls findOneAndReplace and saves a document when connected', async function () {
    const document: { _id: string; price?: number } = { _id: '123' };
    const newDocument = { _id: '123', price: 5000 };
    const source = DocumentSource.treeview;

    const fakeActiveConnectionId = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId,
    );

    const fakeGetActiveDataService = sandbox.fake.returns({
      findOneAndReplace: () => {
        document.price = 5000;

        return Promise.resolve(document);
      },
    });
    sandbox.replace(
      testConnectionController,
      'getActiveDataService',
      fakeGetActiveDataService,
    );

    await testMongoDBDocumentService.replaceDocument({
      namespace,
      documentId,
      connectionId,
      newDocument,
      source,
    });

    expect(document).to.be.deep.equal(newDocument);
  });

  test('replaceDocument calls findOneAndReplace and saves a document when connected - extending the uuid type', async function () {
    const document: { _id: string; myUuid?: { $uuid: string } } = {
      _id: '123',
    };
    const newDocument = {
      _id: '123',
      myUuid: {
        $binary: {
          base64: 'yO2rw/c4TKO2jauSqRR4ow==',
          subType: '04',
        },
      },
    };
    const source = DocumentSource.treeview;

    const fakeActiveConnectionId = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId,
    );

    const fakeGetActiveDataService = sandbox.fake.returns({
      findOneAndReplace: () => {
        document.myUuid = { $uuid: 'c8edabc3-f738-4ca3-b68d-ab92a91478a3' };

        return Promise.resolve(document);
      },
    });
    sandbox.replace(
      testConnectionController,
      'getActiveDataService',
      fakeGetActiveDataService,
    );

    await testMongoDBDocumentService.replaceDocument({
      namespace,
      documentId,
      connectionId,
      newDocument,
      source,
    });

    expect(document).to.be.deep.equal(document);
  });

  test('fetchDocument calls find and returns a single document when connected ejson', async function () {
    const line = 1;
    const documents = [{ _id: '123' }];
    const source = DocumentSource.playground;

    const fakeGetActiveDataService = sandbox.fake.returns({
      find: () => {
        return Promise.resolve(documents);
      },
    });
    sandbox.replace(
      testConnectionController,
      'getActiveDataService',
      fakeGetActiveDataService,
    );

    const fakeGetActiveConnectionId = sandbox.fake.returns(connectionId);
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeGetActiveConnectionId,
    );

    const result = await testMongoDBDocumentService.fetchDocument({
      namespace,
      documentId,
      line,
      format: 'ejson',
      connectionId,
      source,
    });

    expect(result).to.be.deep.equal(
      EJSON.serialize(documents[0], { relaxed: false }),
    );
  });

  test('fetchDocument calls find and returns a single document when connected shell', async function () {
    const line = 1;
    const documents = [
      {
        _id: new ObjectId('6536b0aef59f6ffc9af93f3c'),
        pineapple: new Long('90071992547409920'),
        name: 'Berlin',
      },
    ];
    const source = DocumentSource.playground;

    const fakeGetActiveDataService = sandbox.fake.returns({
      find: () => {
        return Promise.resolve(documents);
      },
    });
    sandbox.replace(
      testConnectionController,
      'getActiveDataService',
      fakeGetActiveDataService,
    );

    const fakeGetActiveConnectionId = sandbox.fake.returns(connectionId);
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeGetActiveConnectionId,
    );

    const result = await testMongoDBDocumentService.fetchDocument({
      namespace,
      documentId,
      line,
      format: 'shell',
      connectionId,
      source,
    });

    expect(result).to.be.deep.equal(documents[0]);
  });

  test("if a user is not connected, documents won't be saved to MongoDB", async function () {
    const newDocument = { _id: '123', price: 5000 };
    const source = DocumentSource.treeview;

    const fakeActiveConnectionId = sandbox.fake.returns(null);
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId,
    );

    const fakeGetSavedConnectionName = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getSavedConnectionName',
      fakeGetSavedConnectionName,
    );

    try {
      await testMongoDBDocumentService.replaceDocument({
        documentId,
        namespace,
        connectionId,
        newDocument,
        source,
      });
      throw new Error('expected earlier failure');
    } catch (error) {
      const expectedMessage =
        "Unable to save document: no longer connected to 'tasty_sandwhich'";

      expect(formatError(error).message).to.be.equal(expectedMessage);
    }
  });

  test("if a user switched the active connection, document opened from the previous connection can't be saved", async function () {
    const newDocument = { _id: '123', price: 5000 };
    const source = DocumentSource.playground;

    const fakeActiveConnectionId = sandbox.fake.returns('berlin.coctails');
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeActiveConnectionId,
    );

    const fakeGetSavedConnectionName = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getSavedConnectionName',
      fakeGetSavedConnectionName,
    );

    try {
      await testMongoDBDocumentService.replaceDocument({
        documentId,
        namespace,
        connectionId,
        newDocument,
        source,
      });
      throw new Error('expected earlier failure');
    } catch (error) {
      const expectedMessage =
        "Unable to save document: no longer connected to 'tasty_sandwhich'";

      expect(formatError(error).message).to.be.equal(expectedMessage);
    }
  });

  test("if a user switched the active connection, document can't be opened from the old playground results", async function () {
    const line = 1;
    const source = DocumentSource.playground;

    const fakeGetActiveConnectionId = sandbox.fake.returns('345');
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionId',
      fakeGetActiveConnectionId,
    );

    const fakeGetSavedConnectionName = sandbox.fake.returns('tasty_sandwhich');
    sandbox.replace(
      testConnectionController,
      'getSavedConnectionName',
      fakeGetSavedConnectionName,
    );

    try {
      await testMongoDBDocumentService.fetchDocument({
        namespace,
        documentId,
        line,
        format: 'ejson',
        connectionId: '123',
        source,
      });
      throw new Error('expected earlier failure');
    } catch (error) {
      const expectedMessage =
        "Unable to fetch document: no longer connected to 'tasty_sandwhich'";

      expect(formatError(error).message).to.be.equal(expectedMessage);
    }
  });
});
