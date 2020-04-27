import * as vscode from 'vscode';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { TelemetryController } from '../../../telemetry';

const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-as-promised'));
config({ path: resolve(__dirname, '../../../../.env') });

suite('Telemetry Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

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
});
