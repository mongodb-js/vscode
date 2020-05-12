import * as vscode from 'vscode';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { resolve } from 'path';
import { config } from 'dotenv';
import TelemetryController, {
  TelemetryEventTypes
} from '../../../telemetry/telemetryController';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { afterEach, beforeEach } from 'mocha';
import { TEST_DATABASE_URI } from './../dbTestHelper';
import Connection = require('mongodb-connection-model/lib/model');
import { StorageScope } from '../../../storage/storageController';
import { ConnectionTypes } from '../../../connectionController';
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
  let mockTelemetryTrackMethod: void;
  let mockExecuteAllMethod: Promise<any>;
  let mockGetCloudInfoFromDataService: Promise<any>;
  let mockConnect: Promise<any>;

  beforeEach(async () => {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('sendTelemetry', true);
    mockTelemetryTrackMethod = sinon.fake();
    mockExecuteAllMethod = sinon.fake.resolves({
      shellApiType: 'TEST'
    });
    mockGetCloudInfoFromDataService = sinon.fake.resolves({
      isPublicCloud: false,
      publicCloudName: null
    });
    mockConnect = sinon.fake.resolves(true);

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'track',
      mockTelemetryTrackMethod
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._languageServerController,
      'executeAll',
      mockExecuteAllMethod
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getCloudInfoFromDataService',
      mockGetCloudInfoFromDataService
    );
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'connect',
      mockConnect
    );
  });

  afterEach(async () => {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('sendTelemetry', false);
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
          mockTelemetryTrackMethod,
          TelemetryEventTypes.EXTENSION_COMMAND_RUN,
          {
            command: 'mdb.showActiveConnectionInPlayground'
          }
        );
      })
      .then(done, done);
  });

  test('track playground code executed event', async () => {
    const mockPlaygroundController =
      mdbTestExtension.testExtensionController._playgroundController;

    await mockPlaygroundController.evaluate('show dbs');

    sinon.assert.calledWith(
      mockTelemetryTrackMethod,
      TelemetryEventTypes.PLAYGROUND_CODE_EXECUTED,
      {
        type: 'other'
      }
    );
  });

  test('test new connection event when connecting via connection string', (done) => {
    const mockConnectionController =
      mdbTestExtension.testExtensionController._connectionController;

    mockConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(() => {
        sinon.assert.calledWith(
          mockConnect,
          sinon.match.any,
          sinon.match.any,
          sinon.match(ConnectionTypes.CONNECTION_STRING)
        );
        done();
      });
  });

  test('test new connection event when connecting via connection form', (done) => {
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
          mockConnect,
          sinon.match.any,
          sinon.match.any,
          sinon.match(ConnectionTypes.CONNECTION_FORM)
        );
        done();
      });
  });

  test('test new connection event when connecting via saved connection', (done) => {
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
        mockConnect,
        sinon.match.any,
        sinon.match.any,
        sinon.match(ConnectionTypes.CONNECTION_ID)
      );
      done();
    });
  });
});
