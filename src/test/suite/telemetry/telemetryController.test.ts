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
  let mockTelemetryTrackMethod: void;
  let mockExecuteAllMethod: Promise<any>;
  let mockGetCloudInfoFromDataService: Promise<any>;

  beforeEach(() => {
    mockTelemetryTrackMethod = sinon.fake.resolves();
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'track',
      mockTelemetryTrackMethod
    );
    mockExecuteAllMethod = sinon.fake.resolves({
      shellApiType: 'TEST'
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._languageServerController,
      'executeAll',
      mockExecuteAllMethod
    );
    mockGetCloudInfoFromDataService = sinon.fake.resolves({
      isPublicCloud: false,
      publicCloudName: null
    });
    sinon.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getCloudInfoFromDataService',
      mockGetCloudInfoFromDataService
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  test('get segment key from constants keyfile', () => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    let segmentKey: string | undefined;

    try {
      const segmentKeyFileLocation = '../../../../constants';
      segmentKey = require(segmentKeyFileLocation)?.segmentKey;
    } catch (error) {
      expect(error).to.be.undefined;
    }

    expect(segmentKey).to.be.equal(process.env.SEGMENT_KEY);
    expect(testTelemetryController.segmentKey).to.be.a('string');
  });

  test('get user id from the global storage', () => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );

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
    await mdbTestExtension.testExtensionController._playgroundController.evaluate(
      'show dbs'
    );

    sinon.assert.calledWith(
      mockTelemetryTrackMethod,
      TelemetryEventTypes.PLAYGROUND_CODE_EXECUTED,
      {
        type: 'other'
      }
    );
  });
});
