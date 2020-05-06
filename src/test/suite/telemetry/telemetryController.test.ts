import * as vscode from 'vscode';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { TelemetryController } from '../../../telemetry';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { afterEach, beforeEach } from 'mocha';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);
  let mockTelemetryTrackMethod: void;
  let mockExecuteAllMethod: Promise<any>;

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
      .executeCommand('mdb.createPlayground')
      .then(() => {
        sinon.assert.calledWith(mockTelemetryTrackMethod, 'command run', {
          command: 'mdb.createPlayground'
        });
      })
      .then(done, done);
  });

  test('track playground code executed event', async () => {
    await mdbTestExtension.testExtensionController._playgroundController.evaluate(
      'show dbs'
    );

    sinon.assert.calledWith(
      mockTelemetryTrackMethod,
      'playground code executed',
      {
        type: 'other'
      }
    );
  });
});
