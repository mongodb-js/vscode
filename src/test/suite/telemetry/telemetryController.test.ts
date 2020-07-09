import * as vscode from 'vscode';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { resolve } from 'path';
import { config } from 'dotenv';
import TelemetryController from '../../../telemetry/telemetryController';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { afterEach, beforeEach } from 'mocha';
import Connection = require('mongodb-connection-model/lib/model');
import { ConnectionTypes } from '../../../connectionController';
import { getDocUri, loadAndSavePlayground } from '../editorTestHelper';
import DataService = require('mongodb-data-service');

const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const expect = chai.expect;

chai.use(sinonChai);

config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const dataService = new DataService(
    new Connection({
      hostname: 'localhost',
      port: 27018
    })
  );
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryController = new TelemetryController(
    mockStorageController,
    mockExtensionContext
  );
  let mockTrackNewConnection: Promise<any>;
  let mockTrackCommandRun: Promise<void>;
  let mockTrackPlaygroundCodeExecuted: Promise<void>;
  let mockTrackPlaygroundLoadedMethod: Promise<void>;
  let mockTrackPlaygroundSavedMethod: Promise<void>;

  beforeEach(() => {
    mockTrackNewConnection = sinon.fake.resolves(true);
    mockTrackCommandRun = sinon.fake.resolves();
    mockTrackPlaygroundCodeExecuted = sinon.fake.resolves();
    mockTrackPlaygroundLoadedMethod = sinon.fake.resolves();
    mockTrackPlaygroundSavedMethod = sinon.fake.resolves();

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'trackNewConnection',
      mockTrackNewConnection
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'trackCommandRun',
      mockTrackCommandRun
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'trackPlaygroundCodeExecuted',
      mockTrackPlaygroundCodeExecuted
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'trackPlaygroundLoaded',
      mockTrackPlaygroundLoadedMethod
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'trackPlaygroundSaved',
      mockTrackPlaygroundSavedMethod
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._languageServerController,
      'executeAll',
      sinon.fake.resolves({
        shellApiType: 'TEST'
      })
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  test('get segment key and user id', () => {
    let segmentKey: string | undefined;

    try {
      const segmentKeyFileLocation = '../../../../constants';
      segmentKey = require(segmentKeyFileLocation)?.segmentKey;
    } catch (error) {
      expect(error).to.be.undefined;
    }

    expect(segmentKey).to.be.equal(process.env.SEGMENT_KEY);
    expect(testTelemetryController.segmentKey).to.be.a('string');
    expect(testTelemetryController.segmentUserID).to.be.a('string');
  });

  test('track command run event', (done) => {
    vscode.commands
      .executeCommand('mdb.showActiveConnectionInPlayground', 'Test')
      .then(() => {
        sinon.assert.calledWith(
          mockTrackCommandRun,
          'mdb.showActiveConnectionInPlayground'
        );
      })
      .then(done, done);
  });

  test('track new connection event when connecting via connection string', () => {
    const mockConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    mockConnectionController.sendTelemetry(
      dataService,
      ConnectionTypes.CONNECTION_STRING
    );

    sinon.assert.calledWith(
      mockTrackNewConnection,
      sinon.match.any,
      sinon.match(ConnectionTypes.CONNECTION_STRING)
    );
  });

  test('track new connection event when connecting via connection form', () => {
    const mockConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    mockConnectionController.sendTelemetry(
      dataService,
      ConnectionTypes.CONNECTION_FORM
    );

    sinon.assert.calledWith(
      mockTrackNewConnection,
      sinon.match.any,
      sinon.match(ConnectionTypes.CONNECTION_FORM)
    );
  });

  test('track new connection event when connecting via saved connection', () => {
    const mockConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    mockConnectionController.sendTelemetry(
      dataService,
      ConnectionTypes.CONNECTION_ID
    );

    sinon.assert.calledWith(
      mockTrackNewConnection,
      sinon.match.any,
      sinon.match(ConnectionTypes.CONNECTION_ID)
    );
  });

  test('track playground code executed event', async () => {
    const mockPlaygroundController =
      mdbTestExtension.testExtensionController._playgroundController;

    await mockPlaygroundController.evaluate('show dbs');

    sinon.assert.called(mockTrackPlaygroundCodeExecuted);
  });

  test('track playground loaded and saved events', async function () {
    this.timeout(3000);
    await loadAndSavePlayground(getDocUri('testSaving.mongodb'));

    sinon.assert.called(mockTrackPlaygroundLoadedMethod);
    sinon.assert.called(mockTrackPlaygroundSavedMethod);
  });

  suite('prepare playground result types', () => {
    test('convert AggregationCursor shellApiType to aggregation telemetry type', () => {
      const res = { shellApiType: 'AggregationCursor' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('aggregation');
    });

    test('convert BulkWriteResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'BulkWriteResult' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Collection shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'Collection' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Cursor shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'Cursor' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('query');
    });

    test('convert Database shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'Database' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert DeleteResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'DeleteResult' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('delete');
    });

    test('convert InsertManyResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'InsertManyResult' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('insert');
    });

    test('convert InsertOneResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'InsertOneResult' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('insert');
    });

    test('convert ReplicaSet shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'ReplicaSet' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Shard shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'Shard' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert ShellApi shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'ShellApi' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert UpdateResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'UpdateResult' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('update');
    });

    test('convert UpdateResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'UpdateResult' };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('update');
    });

    test('return other telemetry type if evaluation returns a string', () => {
      const res = '2';
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });
  });
});
