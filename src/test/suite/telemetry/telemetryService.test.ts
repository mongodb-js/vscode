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

import { DocumentSource } from '../../../documentSource';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { DatabaseTreeItem, DocumentTreeItem } from '../../../explorer';
import { DataServiceStub } from '../stubs';
import {
  DocumentEditedTelemetryEvent,
  DocumentUpdatedTelemetryEvent,
  LinkClickedTelemetryEvent,
  ParticipantFeedbackTelemetryEvent,
  PlaygroundExecutedTelemetryEvent,
  PlaygroundExportedToLanguageTelemetryEvent,
  PlaygroundSavedTelemetryEvent,
  SavedConnectionsLoadedTelemetryEvent,
} from '../../../telemetry';
import type { SegmentProperties } from '../../../telemetry/telemetryService';
import { ConnectionType } from '../../../connectionController';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../../package.json');

const expect = chai.expect;

chai.use(sinonChai);

config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', function () {
  const testTelemetryService =
    mdbTestExtension.testExtensionController._telemetryService;

  let dataServiceStub: DataService;
  let fakeSegmentAnalyticsTrack: SinonSpy;

  const testDeviceId = 'test-device-id';
  const telemetryIdentity = {
    anonymousId: testTelemetryService.anonymousId,
  };
  const commonProperties = {
    extension_version: version,
    device_id: testDeviceId,
    app_name: vscode.env.appName || 'Visual Studio Code - Unknown',
  };

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
    } as unknown as DataService;

    fakeSegmentAnalyticsTrack = sandbox.fake();
    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      '_segmentAnalyticsTrack',
      fakeSegmentAnalyticsTrack,
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      // @ts-expect-error This is a private method
      'getDeviceId',
      () => {
        return Promise.resolve(testDeviceId);
      },
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
      }),
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._connectionController,
      'getActiveConnectionId',
      sandbox.fake.returns('testconnectionId'),
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._playgroundController
        ._connectionController,
      'getMongoClientConnectionOptions',
      sandbox.fake.returns('mongodb://localhost'),
    );
    sandbox.stub(vscode.window, 'showErrorMessage');
    sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.replace(
      testTelemetryService,
      '_isTelemetryFeatureEnabled',
      sandbox.fake.returns(true),
    );
  });

  afterEach(() => {
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    sandbox.restore();
  });

  test('get segment key', function () {
    let segmentKey: string | undefined;

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

  suite('after setup is complete', function () {
    beforeEach(async () => {
      await testTelemetryService.activateSegmentAnalytics();
    });

    test('track command run event', async function () {
      await vscode.commands.executeCommand('mdb.addConnection');
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Command Run',
          properties: {
            command: 'mdb.addConnection',
            ...commonProperties,
          },
        }),
      );
    });

    test('track new connection event when connecting via connection string', async function () {
      await testTelemetryService.trackNewConnection(
        dataServiceStub,
        ConnectionType.connectionString,
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'New Connection',
          properties: {
            is_used_connect_screen: false,
            is_used_command_palette: true,
            is_used_saved_connection: false,
            vscode_mdb_extension_version: version,
            ...commonProperties,
          },
        }),
      );
    });

    test('track new connection event when connecting via connection form', async function () {
      await testTelemetryService.trackNewConnection(
        dataServiceStub,
        ConnectionType.connectionForm,
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'New Connection',
          properties: {
            is_used_connect_screen: true,
            is_used_command_palette: false,
            is_used_saved_connection: false,
            vscode_mdb_extension_version: version,
            ...commonProperties,
          },
        }),
      );
    });

    test('track new connection event when connecting via saved connection', async function () {
      await testTelemetryService.trackNewConnection(
        dataServiceStub,
        ConnectionType.connectionId,
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'New Connection',
          properties: {
            is_used_connect_screen: false,
            is_used_command_palette: false,
            is_used_saved_connection: true,
            vscode_mdb_extension_version: version,
            ...commonProperties,
          },
        }),
      );
    });

    test('track document saved form a tree-view event', function () {
      const source = DocumentSource.treeview;
      testTelemetryService.track(
        new DocumentUpdatedTelemetryEvent(source, true),
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Document Updated',
          properties: {
            source: 'treeview',
            success: true,
            ...commonProperties,
          },
        }),
      );
    });

    test('track document opened form playground results', function () {
      const source = DocumentSource.playground;
      testTelemetryService.track(new DocumentEditedTelemetryEvent(source));
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Document Edited',
          properties: { source: 'playground', extension_version: version },
        }),
      );
    });

    test('track playground code executed event', async function () {
      const testPlaygroundController =
        mdbTestExtension.testExtensionController._playgroundController;
      const source = new vscode.CancellationTokenSource();
      await testPlaygroundController._evaluate(
        {
          codeToEvaluate: 'show dbs',
        },
        source.token,
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Playground Code Executed',
          properties: {
            type: 'other',
            partial: false,
            error: false,
            ...commonProperties,
          },
        }),
      );
    });

    // TODO: re-enable two tests after https://jira.mongodb.org/browse/VSCODE-432
    test.skip('track mongodb playground loaded event', async function () {
      const docPath = path.resolve(
        __dirname,
        '../../../../src/test/fixture/testPlayground.mongodb',
      );
      await vscode.workspace.openTextDocument(vscode.Uri.file(docPath));
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Playground Loaded',
          properties: {
            file_type: 'mongodb',
            ...commonProperties,
          },
        }),
      );
    });

    test.skip('track mongodbjs playground loaded event', async function () {
      const docPath = path.resolve(
        __dirname,
        '../../../../src/test/fixture/testPlayground.mongodb.js',
      );
      await vscode.workspace.openTextDocument(vscode.Uri.file(docPath));
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Playground Loaded',
          properties: {
            file_type: 'mongodbjs',
            ...commonProperties,
          },
        }),
      );
    });

    test('track playground saved event', function () {
      testTelemetryService.track(
        new PlaygroundSavedTelemetryEvent(
          vscode.Uri.file('/users/peter/projects/test/myplayground.mongodb.js'),
        ),
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Playground Saved',
          properties: {
            file_type: 'mongodbjs',
            ...commonProperties,
          },
        }),
      );
    });

    test('track link clicked event', function () {
      testTelemetryService.track(
        new LinkClickedTelemetryEvent('helpPanel', 'linkId'),
      );
      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Link Clicked',
          properties: {
            screen: 'helpPanel',
            link_id: 'linkId',
            ...commonProperties,
          },
        }),
      );
    });

    test('track playground exported to language', function () {
      testTelemetryService.track(
        new PlaygroundExportedToLanguageTelemetryEvent('java', 3, false),
      );

      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Playground Exported To Language',
          properties: {
            language: 'java',
            with_driver_syntax: false,
            ...commonProperties,
          },
        }),
      );
    });

    suite('playground created', function () {
      test('track on search for documents', async function () {
        await vscode.commands.executeCommand('mdb.searchForDocuments', {
          databaseName: 'databaseName',
          collectionName: 'collectionName',
        });
        sandbox.assert.calledWith(
          fakeSegmentAnalyticsTrack,
          sinon.match({
            ...telemetryIdentity,
            event: 'Playground Created',
            properties: {
              playground_type: 'search',
              ...commonProperties,
            },
          }),
        );
      });

      test('track on create collection', async function () {
        const testDatabaseTreeItem = new DatabaseTreeItem({
          databaseName: 'databaseName',
          dataService: new DataServiceStub() as unknown as DataService,
          isExpanded: false,
          cacheIsUpToDate: false,
          childrenCache: {},
        });
        await vscode.commands.executeCommand(
          'mdb.addCollection',
          testDatabaseTreeItem,
        );
        sandbox.assert.calledWith(
          fakeSegmentAnalyticsTrack,
          sinon.match({
            ...telemetryIdentity,
            event: 'Playground Created',
            properties: {
              playground_type: 'createCollection',
              ...commonProperties,
            },
          }),
        );
      });

      test('track on create database', async function () {
        await vscode.commands.executeCommand('mdb.addDatabase', {
          connectionId: 'testconnectionId',
        });
        sandbox.assert.calledWith(
          fakeSegmentAnalyticsTrack,
          sinon.match({
            ...telemetryIdentity,
            event: 'Playground Created',
            properties: {
              playground_type: 'createDatabase',
              ...commonProperties,
            },
          }),
        );
      });

      test('track on create index', async function () {
        await vscode.commands.executeCommand('mdb.createIndexFromTreeView', {
          databaseName: 'databaseName',
          collectionName: 'collectionName',
        });
        sandbox.assert.calledWith(
          fakeSegmentAnalyticsTrack,
          sinon.match({
            ...telemetryIdentity,
            event: 'Playground Created',
            properties: {
              playground_type: 'index',
              ...commonProperties,
            },
          }),
        );
      });

      test('track on clone document', async function () {
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
        } as unknown as DataService;
        const documentItem = new DocumentTreeItem({
          document: mockDocument,
          namespace: 'waffle.house',
          documentIndexInTree: 0,
          dataService: dataServiceStub,
          resetDocumentListCache: (): Promise<void> => Promise.resolve(),
        });
        await vscode.commands.executeCommand(
          'mdb.cloneDocumentFromTreeView',
          documentItem,
        );
        sandbox.assert.calledWith(
          fakeSegmentAnalyticsTrack,
          sinon.match({
            ...telemetryIdentity,
            event: 'Playground Created',
            properties: {
              playground_type: 'cloneDocument',
              ...commonProperties,
            },
          }),
        );
      });

      test('track on crud from the command palette', async function () {
        await vscode.commands.executeCommand('mdb.createPlayground');
        sandbox.assert.calledWith(
          fakeSegmentAnalyticsTrack,
          sinon.match({
            ...telemetryIdentity,
            event: 'Playground Created',
            properties: {
              playground_type: 'crud',
              ...commonProperties,
            },
          }),
        );
      });

      test('track on crud from overview page', async function () {
        await vscode.commands.executeCommand(
          'mdb.createNewPlaygroundFromOverviewPage',
        );
        sandbox.assert.calledWith(
          fakeSegmentAnalyticsTrack,
          sinon.match({
            ...telemetryIdentity,
            event: 'Playground Created',
            properties: {
              playground_type: 'crud',
              ...commonProperties,
            },
          }),
        );
      });

      test('track on crud from tree view', async function () {
        await vscode.commands.executeCommand(
          'mdb.createNewPlaygroundFromTreeView',
        );
        sandbox.assert.calledWith(
          fakeSegmentAnalyticsTrack,
          sinon.match({
            ...telemetryIdentity,
            event: 'Playground Created',
            properties: {
              playground_type: 'crud',
              ...commonProperties,
            },
          }),
        );
      });
    });

    test.skip('track saved connections loaded', function () {
      testTelemetryService.track(
        new SavedConnectionsLoadedTelemetryEvent({
          savedConnections: 3,
          loadedConnections: 3,
          presetConnections: 3,
          connectionsWithSecretsInKeytar: 0,
          connectionsWithSecretsInSecretStorage: 3,
        }),
      );

      sandbox.assert.calledWith(
        fakeSegmentAnalyticsTrack,
        sinon.match({
          ...telemetryIdentity,
          event: 'Saved Connections Loaded',
          properties: {
            saved_connections: 3,
            loaded_connections: 3,
            preset_connections: 3,
            connections_with_secrets_in_keytar: 0,
            connections_with_secrets_in_SecretStorage: 3,
          },
        }),
      );
    });
  });

  suite('prepare playground result types', function () {
    const unmappedTypes = [
      'BulkWriteResult',
      'Collection',
      'Database',
      'ReplicaSet',
      'Shard',
      'ShellApi',
      'string',
      'number',
      'undefined',
    ];
    for (const type of unmappedTypes) {
      test(`reports original type if not remapped: ${type}`, function () {
        const res = {
          result: {
            namespace: undefined,
            type,
            content: '',
            language: 'plaintext',
          },
        };

        const reportedType = new PlaygroundExecutedTelemetryEvent(
          res,
          false,
          false,
        ).properties.type;
        expect(reportedType).to.deep.equal(type?.toLocaleLowerCase());
      });
    }

    const mappedTypes: Record<string, string> = {
      Cursor: 'query',
      DeleteResult: 'delete',
      InsertManyResult: 'insert',
      InsertOneResult: 'insert',
      UpdateResult: 'update',
      AggregationCursor: 'aggregation',
    };

    for (const [shellApiType, telemetryType] of Object.entries(mappedTypes)) {
      test(`convert ${shellApiType} shellApiType to ${telemetryType} telemetry type`, function () {
        const res = {
          result: {
            namespace: undefined,
            type: shellApiType,
            content: '',
            language: 'plaintext',
          },
        };
        const type = new PlaygroundExecutedTelemetryEvent(res, false, false)
          .properties.type;
        expect(type).to.deep.equal(telemetryType);
      });
    }

    test('convert result with missing type to "other"', function () {
      const res = {
        result: {
          namespace: undefined,
          content: '',
          language: 'plaintext',
        },
      };
      const type = new PlaygroundExecutedTelemetryEvent(res, false, false)
        .properties.type;
      expect(type).to.deep.equal('other');
    });

    test('convert shell api result with undefined result field "other"', function () {
      const res = {
        result: undefined,
      };
      const type = new PlaygroundExecutedTelemetryEvent(res, false, false)
        .properties.type;
      expect(type).to.deep.equal('other');
    });

    test('convert null shell api result to null', function () {
      const type = new PlaygroundExecutedTelemetryEvent(null, false, false)
        .properties.type;
      expect(type).to.be.null;
    });
  });

  function enumKeys<
    TEnum extends object,
    TKey extends keyof TEnum = keyof TEnum,
  >(obj: TEnum): TKey[] {
    return Object.keys(obj).filter((k) => Number.isNaN(k)) as TKey[];
  }

  test('ChatResultFeedbackKind to TelemetryFeedbackKind maps all values', function () {
    for (const kind of enumKeys(vscode.ChatResultFeedbackKind)) {
      expect(
        new ParticipantFeedbackTelemetryEvent(
          vscode.ChatResultFeedbackKind[kind],
          'generic',
        ).properties.feedback,
        `Expect ${kind} to produce a concrete telemetry value`,
      ).to.not.be.undefined;
    }
  });

  test('trackTreeViewActivated throttles invocations', async function () {
    this.timeout(6000);

    const verifyEvent = (call: sinon.SinonSpyCall): void => {
      const event = call.args[0] as SegmentProperties;
      expect(event.event).to.equal('Side Panel Opened');
      expect(event.properties).to.have.keys(commonProperties);
      expect(Object.keys(event.properties)).to.have.length(
        Object.keys(commonProperties).length,
      );
    };

    expect(fakeSegmentAnalyticsTrack.getCalls()).has.length(0);

    // First time we call track - should be reported immediately
    testTelemetryService.trackTreeViewActivated();
    expect(fakeSegmentAnalyticsTrack.getCalls()).has.length(1);
    verifyEvent(fakeSegmentAnalyticsTrack.getCall(0));

    // Calling track again without waiting - call should be throttled
    testTelemetryService.trackTreeViewActivated();
    expect(fakeSegmentAnalyticsTrack.getCalls()).has.length(1);

    // Wait less than the throttle time - call should still be throttled
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      testTelemetryService.trackTreeViewActivated();
      expect(fakeSegmentAnalyticsTrack.getCalls()).has.length(1);
    }

    // Wait more than throttle time - 4x1000 + 1100 = 5100 ms, this time the
    // call should be reported.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    testTelemetryService.trackTreeViewActivated();
    expect(fakeSegmentAnalyticsTrack.getCalls()).has.length(2);
    verifyEvent(fakeSegmentAnalyticsTrack.getCall(1));
  });
});
