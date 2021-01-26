import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import chai from 'chai';
import { config } from 'dotenv';
import * as path from 'path';
import { resolve } from 'path';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { promisify } from 'util';

import Connection = require('mongodb-connection-model/lib/model');
import { ConnectionTypes } from '../../../connectionController';
import { NewConnectionTelemetryEventProperties } from '../../../telemetry/telemetryService';
import DataService = require('mongodb-data-service');
import { DocumentSource } from '../../../utils/documentSource';
import { mdbTestExtension } from '../stubbableMdbExtension';
import Sinon = require('sinon');

const { version } = require('../../../../package.json');

const expect = chai.expect;

chai.use(sinonChai);

config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', () => {
  const dataService = new DataService(
    new Connection({
      hostname: 'localhost',
      port: 27018
    })
  );
  const testTelemetryService =
    mdbTestExtension.testExtensionController._telemetryService;

  let mockTrackNewConnection: Sinon.SinonSpy;
  let mockTrackCommandRun: Sinon.SinonSpy;
  let mockTrackPlaygroundCodeExecuted: Sinon.SinonSpy;
  let mockTrackPlaygroundLoadedMethod: Sinon.SinonSpy;
  let mockTrack: Sinon.SinonSpy;

  beforeEach(() => {
    mockTrackNewConnection = sinon.fake.resolves(true);
    mockTrackCommandRun = sinon.fake();
    mockTrackPlaygroundCodeExecuted = sinon.fake();
    mockTrackPlaygroundLoadedMethod = sinon.fake();
    mockTrack = sinon.fake();

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackCommandRun',
      mockTrackCommandRun
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackPlaygroundCodeExecuted',
      mockTrackPlaygroundCodeExecuted
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackPlaygroundLoaded',
      mockTrackPlaygroundLoadedMethod
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._languageServerController,
      'executeAll',
      sinon.fake.resolves([{ type: 'TEST', content: 'Result' }])
    );
    sinon.replace(testTelemetryService, 'track', mockTrack);
  });

  afterEach(() => {
    sinon.restore();
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
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
    expect(testTelemetryService._segmentKey).to.be.a('string');
    expect(testTelemetryService._segmentUserID).to.be.a('string');
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

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackNewConnection',
      mockTrackNewConnection
    );

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

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackNewConnection',
      mockTrackNewConnection
    );

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

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackNewConnection',
      mockTrackNewConnection
    );

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

  test('track document saved form a tree-view event', () => {
    const source = DocumentSource.DOCUMENT_SOURCE_TREEVIEW;

    testTelemetryService.trackDocumentUpdated(source, true);

    sinon.assert.calledWith(
      mockTrack,
      sinon.match('Document Updated'),
      sinon.match({ source, success: true })
    );
  });

  test('track document opened form playground results', async () => {
    const mockTrackDocumentOpenedInEditor: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackDocumentOpenedInEditor',
      mockTrackDocumentOpenedInEditor
    );

    await vscode.commands.executeCommand(
      'mdb.openMongoDBDocumentFromCodeLens',
      {
        source: 'playground',
        line: 1,
        documentId: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        namespace: 'db.coll',
        connectionId: null
      }
    );

    expect(mockTrackDocumentOpenedInEditor.firstArg).to.be.equal('playground');
  });

  test('track playground code executed event', async () => {
    const mockPlaygroundController =
      mdbTestExtension.testExtensionController._playgroundController;

    await mockPlaygroundController._evaluate('show dbs');

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

  test('track playground saved event', () => {
    testTelemetryService.trackPlaygroundSaved();

    sinon.assert.calledWith(mockTrack);
  });

  suite('with active connection', () => {
    let dataServ;

    beforeEach(async () => {
      dataServ = new DataService(
        new Connection({
          hostname: 'localhost',
          port: 27018
        })
      );
      const runConnect = promisify(dataServ.connect.bind(dataServ));
      await runConnect();
    });

    afterEach(async () => {
      const runDisconnect = promisify(dataServ.disconnect.bind(dataServ));
      await runDisconnect();
    });

    test('track new connection event fetches the connection instance information', async() => {
      await mdbTestExtension.testExtensionController._telemetryService.trackNewConnection(
        dataServ,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(mockTrack.firstCall.args[0]).to.equal('New Connection');
      const instanceTelemetry: NewConnectionTelemetryEventProperties = mockTrack.firstCall.args[1];
      expect(instanceTelemetry.extension_version).to.equal(version);
      expect(instanceTelemetry.is_localhost).to.equal(true);
      expect(instanceTelemetry.is_atlas).to.equal(false);
      expect(instanceTelemetry.is_used_connect_screen).to.equal(false);
      expect(instanceTelemetry.is_used_command_palette).to.equal(true);
      expect(instanceTelemetry.is_used_saved_connection).to.equal(false);
      expect(instanceTelemetry.is_genuine).to.equal(true);
    });
  });

  suite('prepare playground result types', () => {
    test('convert AggregationCursor shellApiType to aggregation telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'AggregationCursor', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('aggregation');
    });

    test('convert BulkWriteResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'BulkWriteResult', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Collection shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Collection', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Cursor shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Cursor', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('query');
    });

    test('convert Database shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Database', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert DeleteResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'DeleteResult', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('delete');
    });

    test('convert InsertManyResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'InsertManyResult', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('insert');
    });

    test('convert InsertOneResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'InsertOneResult', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('insert');
    });

    test('convert ReplicaSet shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'ReplicaSet', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Shard shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Shard', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert ShellApi shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'ShellApi', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert UpdateResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'UpdateResult', content: '' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('update');
    });

    test('return other telemetry type if evaluation returns a string', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: null, content: '2' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });
  });
});
