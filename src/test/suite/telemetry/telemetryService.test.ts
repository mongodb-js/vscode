import * as vscode from 'vscode';
import path from 'path';
import { afterEach, beforeEach } from 'mocha';
import chai from 'chai';
import type { DataService } from 'mongodb-data-service';
import { config } from 'dotenv';
import { resolve } from 'path';
import sinon from 'sinon';
import type { SinonSpy } from 'sinon';
import sinonChai from 'sinon-chai';
import SegmentAnalytics from 'analytics-node';

import { ConnectionTypes } from '../../../connectionController';
import { DocumentSource } from '../../../documentSource';
import { ExportToLanguageMode } from '../../../types/playgroundType';
import { mdbTestExtension } from '../stubbableMdbExtension';
import {
  SegmentProperties,
  TelemetryEventTypes,
} from '../../../telemetry/telemetryService';

const expect = chai.expect;
const { version } = require('../../../../package.json');

chai.use(sinonChai);

config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', () => {
  const testTelemetryService =
    mdbTestExtension.testExtensionController._telemetryService;
  let dataServiceStub: DataService;

  let fakeTrackNewConnection: SinonSpy;
  let fakeTrackCommandRun: SinonSpy;
  let fakeTrackPlaygroundCodeExecuted: SinonSpy;
  let fakeTrackPlaygroundLoadedMethod: SinonSpy;
  let fakeTrack: SinonSpy;
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    fakeTrackNewConnection = sandbox.fake.resolves(true);
    fakeTrackCommandRun = sandbox.fake();
    fakeTrackPlaygroundCodeExecuted = sandbox.fake();
    fakeTrackPlaygroundLoadedMethod = sandbox.fake();
    fakeTrack = sandbox.fake();

    const instanceStub = sandbox.stub();
    instanceStub.resolves({
      dataLake: {},
      build: {},
      genuineMongoDB: {},
      host: {},
    } as unknown as Awaited<ReturnType<DataService['instance']>>);
    dataServiceStub = {
      instance: instanceStub,
    } as Pick<DataService, 'instance'> as unknown as DataService;

    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackCommandRun',
      fakeTrackCommandRun
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._telemetryService,
      'trackPlaygroundCodeExecuted',
      fakeTrackPlaygroundCodeExecuted
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._telemetryService,
      'trackPlaygroundLoaded',
      fakeTrackPlaygroundLoadedMethod
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._languageServerController,
      'evaluate',
      sandbox.fake.resolves([{ type: 'TEST', content: 'Result' }])
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._connectionController,
      'getActiveConnectionId',
      sandbox.fake.returns('testconnectionId')
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._languageServerController,
      'getNamespaceForSelection',
      sandbox.fake.resolves({
        collectionName: 'coll',
        databaseName: 'db',
      })
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._connectionController,
      'getMongoClientConnectionOptions',
      sandbox.fake.returns('mongodb://localhost')
    );
    sandbox.stub(vscode.window, 'showErrorMessage');
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController,
      'getTranspiledContent',
      sandbox.fake.resolves({
        namespace: 'db.coll',
        expressio: '{}',
      })
    );
    sandbox.stub(vscode.window, 'showInformationMessage');
  });

  afterEach(() => {
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    sandbox.restore();
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
    sandbox.assert.calledWith(fakeTrackCommandRun, 'mdb.addConnection');
  });

  test('track new connection event when connecting via connection string', () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackNewConnection',
      fakeTrackNewConnection
    );

    testConnectionController.sendTelemetry(
      dataServiceStub,
      ConnectionTypes.CONNECTION_STRING
    );

    sandbox.assert.calledWith(
      fakeTrackNewConnection,
      sandbox.match.any,
      sandbox.match(ConnectionTypes.CONNECTION_STRING)
    );
  });

  test('track new connection event when connecting via connection form', () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackNewConnection',
      fakeTrackNewConnection
    );

    testConnectionController.sendTelemetry(
      dataServiceStub,
      ConnectionTypes.CONNECTION_FORM
    );

    sandbox.assert.calledWith(
      fakeTrackNewConnection,
      sandbox.match.any,
      sandbox.match(ConnectionTypes.CONNECTION_FORM)
    );
  });

  test('track new connection event when connecting via saved connection', () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackNewConnection',
      fakeTrackNewConnection
    );

    testConnectionController.sendTelemetry(
      dataServiceStub,
      ConnectionTypes.CONNECTION_ID
    );

    sandbox.assert.calledWith(
      fakeTrackNewConnection,
      sandbox.match.any,
      sandbox.match(ConnectionTypes.CONNECTION_ID)
    );
  });

  test('track document saved form a tree-view event', () => {
    const source = DocumentSource.DOCUMENT_SOURCE_TREEVIEW;

    sandbox.replace(testTelemetryService, 'track', fakeTrack);

    testTelemetryService.trackDocumentUpdated(source, true);

    sandbox.assert.calledWith(
      fakeTrack,
      sandbox.match('Document Updated'),
      sandbox.match({ source, success: true })
    );
  });

  test('track document opened form playground results', async () => {
    const fakeTrackDocumentOpenedInEditor = sandbox.fake();
    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackDocumentOpenedInEditor',
      fakeTrackDocumentOpenedInEditor
    );

    await vscode.commands.executeCommand(
      'mdb.openMongoDBDocumentFromCodeLens',
      {
        source: 'playground',
        line: 1,
        documentId: '93333a0d-83f6-4e6f-a575-af7ea6187a4a',
        namespace: 'db.coll',
        connectionId: null,
      }
    );

    expect(fakeTrackDocumentOpenedInEditor.firstCall.firstArg).to.be.equal(
      'playground'
    );
  });

  test('track playground code executed event', async () => {
    const testPlaygroundController =
      mdbTestExtension.testExtensionController._playgroundController;
    await testPlaygroundController._evaluate('show dbs');
    sandbox.assert.called(fakeTrackPlaygroundCodeExecuted);
  });

  test('track playground loaded event', async () => {
    const docPath = path.resolve(
      __dirname,
      '../../../../src/test/fixture/testSaving.mongodb'
    );
    await vscode.workspace.openTextDocument(vscode.Uri.file(docPath));
    sandbox.assert.called(fakeTrackPlaygroundLoadedMethod);
  });

  test('track playground saved event', () => {
    sandbox.replace(testTelemetryService, 'track', fakeTrack);
    testTelemetryService.trackPlaygroundSaved();
    sandbox.assert.calledWith(fakeTrack);
  });

  test('track adds extension version to event properties when there are no event properties', () => {
    sandbox.replace(
      testTelemetryService,
      '_isTelemetryFeatureEnabled',
      sandbox.fake.returns(true)
    );
    const fakeSegmentTrack = sandbox.fake.yields(null);
    sandbox.replace(testTelemetryService, '_segmentAnalytics', {
      track: fakeSegmentTrack,
    } as unknown as SegmentAnalytics);

    testTelemetryService.track(TelemetryEventTypes.EXTENSION_LINK_CLICKED);

    const telemetryEvent: SegmentProperties =
      fakeSegmentTrack.firstCall.args[0];

    expect(telemetryEvent.properties).to.deep.equal({
      extension_version: version,
    });
    expect(telemetryEvent.event).to.equal('Link Clicked');
  });

  test('track adds extension version to existing event properties', () => {
    sandbox.replace(
      testTelemetryService,
      '_isTelemetryFeatureEnabled',
      sandbox.fake.returns(true)
    );

    const fakeSegmentTrack = sandbox.fake.yields(null);
    sandbox.replace(testTelemetryService, '_segmentAnalytics', {
      track: fakeSegmentTrack,
    } as unknown as SegmentAnalytics);

    testTelemetryService.track(TelemetryEventTypes.PLAYGROUND_LOADED, {
      source: DocumentSource.DOCUMENT_SOURCE_PLAYGROUND,
    });

    const telemetryEvent: SegmentProperties =
      fakeSegmentTrack.firstCall.args[0];
    expect(telemetryEvent.properties).to.deep.equal({
      extension_version: version,
      source: DocumentSource.DOCUMENT_SOURCE_PLAYGROUND,
    });
    expect(telemetryEvent.event).to.equal('Playground Loaded');
  });

  test('track query exported to language', async function () {
    this.timeout(5000);

    const fakeSegmentTrack = sandbox.fake();
    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackQueryExported',
      fakeSegmentTrack
    );

    const textFromEditor = "{ '_id': 1, 'item': 'abc', 'price': 10 }";
    const selection = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 40 },
    } as vscode.Selection;
    const mode = ExportToLanguageMode.QUERY;
    const language = 'python';

    mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
      mode;
    mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider._exportToLanguageAddons =
      {
        textFromEditor,
        selectedText: textFromEditor,
        selection,
        importStatements: false,
        driverSyntax: false,
        builders: false,
        language,
      };

    await mdbTestExtension.testExtensionController._playgroundController._transpile();

    const telemetryArgs = fakeSegmentTrack.getCall(0).args[0];
    expect(telemetryArgs).to.deep.equal({
      language,
      with_import_statements: false,
      with_builders: false,
      with_driver_syntax: false,
    });
  });

  test('track aggregation exported to language', async function () {
    this.timeout(5000);

    const fakeSegmentTrack = sandbox.fake.yields(null);
    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackAggregationExported',
      fakeSegmentTrack
    );

    const textFromEditor = "[{ '_id': 1, 'item': 'abc', 'price': 10 }]";
    const selection = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 42 },
    } as vscode.Selection;
    const mode = ExportToLanguageMode.AGGREGATION;
    const language = 'java';

    mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
      mode;
    mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider._exportToLanguageAddons =
      {
        textFromEditor,
        // Use undefined instead of the selected text to skip countAggregationStagesInString
        // that might make the test flaky.
        selectedText: undefined,
        selection,
        importStatements: false,
        driverSyntax: false,
        builders: false,
        language,
      };

    await mdbTestExtension.testExtensionController._playgroundController._transpile();

    const telemetryArgs = fakeSegmentTrack.getCall(0).args[0];
    expect(telemetryArgs).to.deep.equal({
      language,
      num_stages: null,
      with_import_statements: false,
      with_builders: false,
      with_driver_syntax: false,
    });
  });

  suite('prepare playground result types', () => {
    test('convert AggregationCursor shellApiType to aggregation telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'AggregationCursor',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('aggregation');
    });

    test('convert BulkWriteResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'BulkWriteResult',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('other');
    });

    test('convert Collection shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'Collection',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('other');
    });

    test('convert Cursor shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'Cursor',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('query');
    });

    test('convert Database shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'Database',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('other');
    });

    test('convert DeleteResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'DeleteResult',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('delete');
    });

    test('convert InsertManyResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'InsertManyResult',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('insert');
    });

    test('convert InsertOneResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'InsertOneResult',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('insert');
    });

    test('convert ReplicaSet shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'ReplicaSet',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('other');
    });

    test('convert Shard shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'Shard',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('other');
    });

    test('convert ShellApi shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'ShellApi',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('other');
    });

    test('convert UpdateResult shellApiType to other telemetry type', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'UpdateResult',
          content: '',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('update');
    });

    test('return other telemetry type if evaluation returns a string', () => {
      const res = {
        outputLines: [],
        result: {
          namespace: null,
          type: null,
          content: '2',
          language: 'plaintext',
        },
      };
      const type = testTelemetryService.getPlaygroundResultType(res);
      expect(type).to.deep.equal('other');
    });
  });
});
