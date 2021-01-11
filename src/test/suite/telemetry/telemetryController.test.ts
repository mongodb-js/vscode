import * as vscode from 'vscode';
import * as path from 'path';
import { resolve } from 'path';
import { config } from 'dotenv';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { afterEach, beforeEach } from 'mocha';
import Connection = require('mongodb-connection-model/lib/model');
import { ConnectionTypes } from '../../../connectionController';
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
  const testTelemetryController =
    mdbTestExtension.testExtensionController._telemetryController;

  let mockTrackNewConnection: Promise<any>;
  let mockTrackCommandRun: Promise<void>;
  let mockTrackPlaygroundCodeExecuted: Promise<void>;
  let mockTrackPlaygroundLoadedMethod: Promise<void>;
  let mockTrack: Promise<void>;

  beforeEach(() => {
    mockTrackNewConnection = sinon.fake.resolves(true);
    mockTrackCommandRun = sinon.fake.resolves();
    mockTrackPlaygroundCodeExecuted = sinon.fake.resolves();
    mockTrackPlaygroundLoadedMethod = sinon.fake.resolves();
    mockTrack = sinon.fake.resolves();

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
      mdbTestExtension.testExtensionController._languageServerController,
      'executeAll',
      sinon.fake.resolves([{ type: 'TEST', content: 'Result' }])
    );
    sinon.replace(testTelemetryController, 'track', mockTrack);
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
      .executeCommand('mdb.addConnection')
      .then(() => {
        sinon.assert.calledWith(mockTrackCommandRun, 'mdb.addConnection');
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

  test('track document saved form a tree-view event', async () => {
    await testTelemetryController.trackDocumentUpdated('treeview', true);

    sinon.assert.calledWith(
      mockTrack,
      sinon.match('Document Updated'),
      sinon.match({ source: 'treeview', success: true })
    );
  });

  test('track playground code executed event', async () => {
    const mockPlaygroundController =
      mdbTestExtension.testExtensionController._playgroundController;

    await mockPlaygroundController.evaluate('show dbs');

    sinon.assert.called(mockTrackPlaygroundCodeExecuted);
  });

  test('track playground loaded event', async () => {
    const docPath = path.resolve(
      __dirname,
      '../../../../src/test/fixture/testSaving.mongodb'
    );

    await vscode.workspace.openTextDocument(vscode.Uri.file(docPath));

    sinon.assert.called(mockTrackPlaygroundLoadedMethod);
  });

  test('track playground saved event', async () => {
    await testTelemetryController.trackPlaygroundSaved();

    sinon.assert.calledWith(mockTrack);
  });

  suite('prepare playground result types', () => {
    test('convert AggregationCursor shellApiType to aggregation telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'AggregationCursor', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('aggregation');
    });

    test('convert BulkWriteResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'BulkWriteResult', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Collection shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Collection', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Cursor shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Cursor', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('query');
    });

    test('convert Database shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Database', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert DeleteResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'DeleteResult', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('delete');
    });

    test('convert InsertManyResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'InsertManyResult', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('insert');
    });

    test('convert InsertOneResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'InsertOneResult', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('insert');
    });

    test('convert ReplicaSet shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'ReplicaSet', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Shard shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Shard', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert ShellApi shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'ShellApi', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert UpdateResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'UpdateResult', content: '' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('update');
    });

    test('return other telemetry type if evaluation returns a string', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: null, content: '2' }
      };
      const type = testTelemetryController.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });
  });
});
