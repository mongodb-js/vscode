/* eslint-disable mocha/no-exclusive-tests */
import * as vscode from 'vscode';
import * as path from 'path';
import { afterEach, beforeEach } from 'mocha';
import chai from 'chai';
import { connect } from 'mongodb-data-service';
import { config } from 'dotenv';
import { resolve } from 'path';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import Sinon = require('sinon');

import { ConnectionTypes } from '../../../connectionController';
import { DocumentSource } from '../../../documentSource';
import { ExportToLanguageMode } from '../../../types/playgroundType';
import { mdbTestExtension } from '../stubbableMdbExtension';
import {
  NewConnectionTelemetryEventProperties
} from '../../../telemetry/connectionTelemetry';
import {
  SegmentProperties,
  TelemetryEventTypes
} from '../../../telemetry/telemetryService';

const expect = chai.expect;
const { version } = require('../../../../package.json');

const TEST_DATABASE_URI = 'mongodb://localhost:27018';

chai.use(sinonChai);

config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', () => {
  const testTelemetryService =
    mdbTestExtension.testExtensionController._telemetryService;
  const mockDataService: any = sinon.fake.returns({
    instance: () => Promise.resolve({
      dataLake: {},
      build: {},
      genuineMongoDB: {},
      host: {}
    })
  });

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
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._connectionController,
      'getActiveConnectionId',
      () => 'testconnectionId'
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._languageServerController,
      'getNamespaceForSelection',
      sinon.fake.resolves({
        collectionName: 'coll',
        databaseName: 'db'
      })
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._connectionController,
      'getMongoClientConnectionOptions',
      sinon.fake.returns('mongodb://localhost')
    );
  });

  afterEach(() => {
    sinon.restore();
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
  });

  test('get segment key', () => {
    let segmentKey: string | undefined;

    try {
      const segmentKeyFileLocation = '../../../../constants';
      segmentKey = require(segmentKeyFileLocation)?.segmentKey;
    } catch (error) {
      expect(error).to.be.undefined;
    }

    expect(segmentKey).to.be.equal(process.env.SEGMENT_KEY);
    expect(testTelemetryService._segmentKey).to.be.a('string');
  });

  test('track command run event', async () => {
    await vscode.commands.executeCommand('mdb.addConnection');
    sinon.assert.calledWith(mockTrackCommandRun, 'mdb.addConnection');
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
      mockDataService,
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
      mockDataService,
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
      mockDataService,
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

    sinon.replace(testTelemetryService, 'track', mockTrack);

    testTelemetryService.trackDocumentUpdated(source, true);

    sinon.assert.calledWith(
      mockTrack,
      sinon.match('Document Updated'),
      sinon.match({ source, success: true })
    );
  });

  test('track document opened form playground results', async () => {
    const mockTrackDocumentOpenedInEditor = sinon.fake();
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

    expect(mockTrackDocumentOpenedInEditor.firstCall.firstArg).to.be.equal('playground');
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
    sinon.replace(testTelemetryService, 'track', mockTrack);

    testTelemetryService.trackPlaygroundSaved();

    sinon.assert.calledWith(mockTrack);
  });

  test('track adds extension version to event properties when there are no event properties', () => {
    sinon.replace(
      testTelemetryService,
      '_isTelemetryFeatureEnabled',
      sinon.fake.returns(true)
    );
    const fakeSegmentTrack = sinon.fake.yields(null);
    sinon.replace(
      testTelemetryService,
      '_segmentAnalytics',
      {
        track: fakeSegmentTrack
      } as any
    );

    testTelemetryService.track(
      TelemetryEventTypes.EXTENSION_LINK_CLICKED
    );

    const telemetryEvent: SegmentProperties = fakeSegmentTrack.firstCall.args[0];

    expect(telemetryEvent.properties).to.deep.equal({
      extension_version: version
    });
    expect(telemetryEvent.event).to.equal('Link Clicked');
  });

  test('track adds extension version to existing event properties', () => {
    sinon.replace(
      testTelemetryService,
      '_isTelemetryFeatureEnabled',
      sinon.fake.returns(true)
    );
    const fakeSegmentTrack = sinon.fake.yields(null);
    sinon.replace(
      testTelemetryService,
      '_segmentAnalytics',
      {
        track: fakeSegmentTrack
      } as any
    );

    testTelemetryService.track(
      TelemetryEventTypes.PLAYGROUND_LOADED,
      {
        source: DocumentSource.DOCUMENT_SOURCE_PLAYGROUND
      }
    );

    const telemetryEvent: SegmentProperties = fakeSegmentTrack.firstCall.args[0];

    expect(telemetryEvent.properties).to.deep.equal({
      extension_version: version,
      source: DocumentSource.DOCUMENT_SOURCE_PLAYGROUND
    });
    expect(telemetryEvent.event).to.equal('Playground Loaded');
  });

  test('track query exported to language', async function () {
    this.timeout(5000);

    const fakeSegmentTrack = sinon.fake.yields(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackQueryExported',
      fakeSegmentTrack
    );

    const textFromEditor = "{ '_id': 1, 'item': 'abc', 'price': 10 }";
    const selection = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 40 }
    } as vscode.Selection;
    const mode = ExportToLanguageMode.QUERY;
    const language = 'python';

    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.mode = mode;
    mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider._exportToLanguageAddons = {
      textFromEditor,
      selectedText: textFromEditor,
      selection,
      importStatements: false,
      driverSyntax: false,
      builders: false,
      language
    };

    await mdbTestExtension.testExtensionController._playgroundController._transpile();

    const telemetryArgs = fakeSegmentTrack.firstCall.args[0];

    expect(telemetryArgs).to.deep.equal({
      language,
      with_import_statements: false,
      with_builders: false,
      with_driver_syntax: false
    });
  });

  test('track aggregation exported to language', async function () {
    this.timeout(5000);

    const fakeSegmentTrack = sinon.fake.yields(null);
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackAggregationExported',
      fakeSegmentTrack
    );

    const textFromEditor = "[{ '_id': 1, 'item': 'abc', 'price': 10 }]";
    const selection = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 42 }
    } as vscode.Selection;
    const mode = ExportToLanguageMode.AGGREGATION;
    const language = 'java';

    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.mode = mode;
    mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider._exportToLanguageAddons = {
      textFromEditor,
      selectedText: textFromEditor,
      selection,
      importStatements: false,
      driverSyntax: true,
      builders: false,
      language
    };

    await mdbTestExtension.testExtensionController._playgroundController._transpile();

    const telemetryArgs = fakeSegmentTrack.firstCall.args[0];

    expect(telemetryArgs).to.deep.equal({
      language,
      num_stages: 1,
      with_import_statements: false,
      with_builders: false,
      with_driver_syntax: true
    });
  });

  suite('with active connection', function () {
    this.timeout(5000);

    let dataServ;
    beforeEach(async () => {
      try {
        dataServ = await connect({ connectionString: TEST_DATABASE_URI });
      } catch (error) {
        expect(error).to.be.undefined;
      }
    });

    afterEach(async () => {
      sinon.restore();
      await dataServ.disconnect();
    });

    test('track new connection event fetches the connection instance information', async() => {
      sinon.replace(testTelemetryService, 'track', mockTrack);
      sinon.replace(testTelemetryService, '_isTelemetryFeatureEnabled', () => true);
      await mdbTestExtension.testExtensionController._telemetryService.trackNewConnection(
        dataServ,
        ConnectionTypes.CONNECTION_STRING
      );

      expect(mockTrack.firstCall.args[0]).to.equal('New Connection');
      const instanceTelemetry: NewConnectionTelemetryEventProperties = mockTrack.firstCall.args[1];
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
        result: { namespace: null, type: 'AggregationCursor', content: '', language: 'plaintext' },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('aggregation');
    });

    test('convert BulkWriteResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'BulkWriteResult', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Collection shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Collection', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Cursor shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Cursor', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('query');
    });

    test('convert Database shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Database', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert DeleteResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'DeleteResult', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('delete');
    });

    test('convert InsertManyResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'InsertManyResult', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('insert');
    });

    test('convert InsertOneResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'InsertOneResult', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('insert');
    });

    test('convert ReplicaSet shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'ReplicaSet', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert Shard shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'Shard', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert ShellApi shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'ShellApi', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });

    test('convert UpdateResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: 'UpdateResult', content: '', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('update');
    });

    test('return other telemetry type if evaluation returns a string', () => {
      const res = {
        outputLines: [],
        result: { namespace: null, type: null, content: '2', language: 'plaintext' }
      };
      const type = testTelemetryService.getPlaygroundResultType(res);

      expect(type).to.deep.equal('other');
    });
  });
});
