import * as vscode from 'vscode';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { resolve } from 'path';
import { config } from 'dotenv';
import TelemetryController from '../../../telemetry/telemetryController';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { afterEach, beforeEach } from 'mocha';
import { TEST_DATABASE_URI } from './../dbTestHelper';
import Connection = require('mongodb-connection-model/lib/model');
import { StorageScope } from '../../../storage/storageController';
import { ConnectionTypes } from '../../../connectionController';
import { getDocUri, loadAndSavePlayground } from '../editorTestHelper';

const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const expect = chai.expect;

chai.use(sinonChai);

config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

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
    // Reset our mock extension's state.
    mockExtensionContext._workspaceState = {};
    mockExtensionContext._globalState = {};
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

  test('track new connection event when connecting via connection string', (done) => {
    const mockConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    mockConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(() => {
        sinon.assert.calledWith(
          mockTrackNewConnection,
          sinon.match.any,
          sinon.match(ConnectionTypes.CONNECTION_STRING)
        );
        done();
      });
  });

  test('track new connection event when connecting via connection form', (done) => {
    const mockConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    mockConnectionController
      .parseNewConnectionAndConnect(
        new Connection({
          hostname: 'localhost',
          port: 27018
        })
      )
      .then(() => {
        sinon.assert.calledWith(
          mockTrackNewConnection,
          sinon.match.any,
          sinon.match(ConnectionTypes.CONNECTION_FORM)
        );
        done();
      });
  });

  test('track new connection event when connecting via saved connection', (done) => {
    const mockConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    mockConnectionController._connections = {
      '25': {
        id: '25',
        driverUrl: TEST_DATABASE_URI,
        name: 'tester',
        connectionModel: new Connection({
          hostname: 'localhost',
          port: 27018
        }),
        storageLocation: StorageScope.NONE
      }
    };

    mockConnectionController.connectWithConnectionId('25').then(() => {
      sinon.assert.calledWith(
        mockTrackNewConnection,
        sinon.match.any,
        sinon.match(ConnectionTypes.CONNECTION_ID)
      );
      done();
    });
  });

  test('track playground code executed event', async () => {
    const mockPlaygroundController =
      mdbTestExtension.testExtensionController._playgroundController;

    await mockPlaygroundController.evaluate('show dbs');

    sinon.assert.called(mockTrackPlaygroundCodeExecuted);
  });

  test('track playground loaded and saved events', async () => {
    await loadAndSavePlayground(getDocUri('test.mongodb'));

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
