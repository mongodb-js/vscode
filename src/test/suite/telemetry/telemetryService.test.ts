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

import { ConnectionTypes } from '../../../connectionController';
import { DocumentSource } from '../../../documentSource';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { DatabaseTreeItem, DocumentTreeItem } from '../../../explorer';
import { DataServiceStub } from '../stubs';

const expect = chai.expect;

chai.use(sinonChai);

config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', () => {
  const testTelemetryService =
    mdbTestExtension.testExtensionController._telemetryService;
  let dataServiceStub: DataService;
  const { anonymousId } = testTelemetryService.getTelemetryUserIdentity();

  let fakeSegmentAnalyticsTrack: SinonSpy;

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
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

    fakeSegmentAnalyticsTrack = sandbox.fake();
    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      '_segmentAnalyticsTrack',
      fakeSegmentAnalyticsTrack
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._languageServerController,
      'evaluate',
      sandbox.fake.resolves({
        result: {
          namespace: 'db.coll',
          type: 'other',
          content: 'dbs',
          language: 'plaintext',
        },
      })
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
    sandbox.replace(
      testTelemetryService,
      '_isTelemetryFeatureEnabled',
      sandbox.fake.returns(true)
    );
  });

  afterEach(() => {
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    sandbox.restore();
  });

  test('get segment key', () => {
    let segmentKey;

    try {
      const segmentKeyFileLocation = '../../../../constants';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      segmentKey = require(segmentKeyFileLocation)?.segmentKey;
    } catch (error) {
      expect(error).to.be.undefined;
    }

    expect(segmentKey).to.be.equal(process.env.SEGMENT_KEY);
    expect(testTelemetryService._segmentKey).to.be.a('string');
  });

  test('track command run event', async () => {
    await vscode.commands.executeCommand('mdb.addConnection');
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Command Run',
        properties: {
          command: 'mdb.addConnection',
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track new connection event when connecting via connection string', async () => {
    await testTelemetryService.trackNewConnection(
      dataServiceStub,
      ConnectionTypes.CONNECTION_STRING
    );
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'New Connection',
        properties: {
          is_used_connect_screen: false,
          is_used_command_palette: true,
          is_used_saved_connection: false,
          vscode_mdb_extension_version: '0.0.0-dev.0',
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track new connection event when connecting via connection form', async () => {
    await testTelemetryService.trackNewConnection(
      dataServiceStub,
      ConnectionTypes.CONNECTION_FORM
    );
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'New Connection',
        properties: {
          is_used_connect_screen: true,
          is_used_command_palette: false,
          is_used_saved_connection: false,
          vscode_mdb_extension_version: '0.0.0-dev.0',
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track new connection event when connecting via saved connection', async () => {
    await testTelemetryService.trackNewConnection(
      dataServiceStub,
      ConnectionTypes.CONNECTION_ID
    );
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'New Connection',
        properties: {
          is_used_connect_screen: false,
          is_used_command_palette: false,
          is_used_saved_connection: true,
          vscode_mdb_extension_version: '0.0.0-dev.0',
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track document saved form a tree-view event', () => {
    const source = DocumentSource.DOCUMENT_SOURCE_TREEVIEW;
    testTelemetryService.trackDocumentUpdated(source, true);
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Document Updated',
        properties: {
          source: 'treeview',
          success: true,
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track document opened form playground results', () => {
    const source = DocumentSource.DOCUMENT_SOURCE_PLAYGROUND;
    testTelemetryService.trackDocumentOpenedInEditor(source);
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Document Edited',
        properties: { source: 'playground', extension_version: '0.0.0-dev.0' },
      })
    );
  });

  test('track playground code executed event', async () => {
    const testPlaygroundController =
      mdbTestExtension.testExtensionController._playgroundController;
    await testPlaygroundController._evaluate('show dbs');
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Playground Code Executed',
        properties: {
          type: 'other',
          partial: false,
          error: false,
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  // TODO: re-enable two tests after https://jira.mongodb.org/browse/VSCODE-432
  test.skip('track mongodb playground loaded event', async () => {
    const docPath = path.resolve(
      __dirname,
      '../../../../src/test/fixture/testSaving.mongodb'
    );
    await vscode.workspace.openTextDocument(vscode.Uri.file(docPath));
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Playground Loaded',
        properties: {
          file_type: 'mongodb',
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test.skip('track mongodbjs playground loaded event', async () => {
    const docPath = path.resolve(
      __dirname,
      '../../../../src/test/fixture/testSaving.mongodb.js'
    );
    await vscode.workspace.openTextDocument(vscode.Uri.file(docPath));
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Playground Loaded',
        properties: {
          file_type: 'mongodbjs',
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track playground saved event', () => {
    testTelemetryService.trackPlaygroundSaved('mongodbjs');
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Playground Saved',
        properties: {
          file_type: 'mongodbjs',
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track link clicked event', () => {
    testTelemetryService.trackLinkClicked('helpPanel', 'linkId');
    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Link Clicked',
        properties: {
          screen: 'helpPanel',
          link_id: 'linkId',
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track query exported to language', function () {
    testTelemetryService.trackQueryExported({
      language: 'python',
      with_import_statements: false,
      with_builders: false,
      with_driver_syntax: false,
    });

    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Query Exported',
        properties: {
          language: 'python',
          with_import_statements: false,
          with_builders: false,
          with_driver_syntax: false,
          extension_version: '0.0.0-dev.0',
        },
      })
    );
  });

  test('track aggregation exported to language', () => {
    testTelemetryService.trackAggregationExported({
      language: 'java',
      num_stages: 1,
      with_import_statements: false,
      with_builders: false,
      with_driver_syntax: false,
    });

    sandbox.assert.calledWith(
      fakeSegmentAnalyticsTrack,
      sinon.match({
        anonymousId,
        event: 'Aggregation Exported',
        properties: {
          language: 'java',
          num_stages: 1,
          with_import_statements: false,
          with_builders: false,
          with_driver_syntax: false,
          extension_version: '0.0.0-dev.0',
        },
      })
    );
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

  suite('playground created', () => {
    test('track on search for documents', async () => {
      await vscode.commands.executeCommand('mdb.searchForDocuments', {
        databaseName: 'databaseName',
        collectionName: 'collectionName',
      });
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          anonymousId,
          event: 'Playground Created',
          properties: {
            playground_type: 'search',
            extension_version: '0.0.0-dev.0',
          },
        })
      );
    });

    test('track on create collection', async () => {
      const testDatabaseTreeItem = new DatabaseTreeItem({
        databaseName: 'databaseName',
        dataService: new DataServiceStub() as unknown as DataService,
        isExpanded: false,
        cacheIsUpToDate: false,
        childrenCache: {},
      });
      await vscode.commands.executeCommand(
        'mdb.addCollection',
        testDatabaseTreeItem
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          anonymousId,
          event: 'Playground Created',
          properties: {
            playground_type: 'createCollection',
            extension_version: '0.0.0-dev.0',
          },
        })
      );
    });

    test('track on create database', async () => {
      await vscode.commands.executeCommand('mdb.addDatabase', {
        connectionId: 'testconnectionId',
      });
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          anonymousId,
          event: 'Playground Created',
          properties: {
            playground_type: 'createDatabase',
            extension_version: '0.0.0-dev.0',
          },
        })
      );
    });

    test('track on create index', async () => {
      await vscode.commands.executeCommand('mdb.createIndexFromTreeView', {
        databaseName: 'databaseName',
        collectionName: 'collectionName',
      });
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          anonymousId,
          event: 'Playground Created',
          properties: {
            playground_type: 'index',
            extension_version: '0.0.0-dev.0',
          },
        })
      );
    });

    test('track on clone document', async () => {
      const mockDocument = {
        _id: 'pancakes',
        name: '',
        time: {
          $time: '12345',
        },
      };
      const dataServiceStub = {
        find: () => {
          return Promise.resolve([mockDocument]);
        },
      } as Pick<DataService, 'find'> as unknown as DataService;
      const documentItem = new DocumentTreeItem({
        document: mockDocument,
        namespace: 'waffle.house',
        documentIndexInTree: 0,
        dataService: dataServiceStub,
        resetDocumentListCache: () => Promise.resolve(),
      });
      await vscode.commands.executeCommand(
        'mdb.cloneDocumentFromTreeView',
        documentItem
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          anonymousId,
          event: 'Playground Created',
          properties: {
            playground_type: 'cloneDocument',
            extension_version: '0.0.0-dev.0',
          },
        })
      );
    });

    test('track on crud from the command palette', async () => {
      await vscode.commands.executeCommand('mdb.createPlayground');
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          anonymousId,
          event: 'Playground Created',
          properties: {
            playground_type: 'crud',
            extension_version: '0.0.0-dev.0',
          },
        })
      );
    });

    test('track on crud from overview page', async () => {
      await vscode.commands.executeCommand(
        'mdb.createNewPlaygroundFromOverviewPage'
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          anonymousId,
          event: 'Playground Created',
          properties: {
            playground_type: 'crud',
            extension_version: '0.0.0-dev.0',
          },
        })
      );
    });

    test('track on crud from tree view', async () => {
      await vscode.commands.executeCommand(
        'mdb.createNewPlaygroundFromTreeView'
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          anonymousId,
          event: 'Playground Created',
          properties: {
            playground_type: 'crud',
            extension_version: '0.0.0-dev.0',
          },
        })
      );
    });
  });
});
