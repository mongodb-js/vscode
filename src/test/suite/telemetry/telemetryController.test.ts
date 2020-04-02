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
    const testPlaygroundController = new TelemetryController(mockStorageController);
    let segmentKey: string | undefined;

    try {
      segmentKey = require('../../../../constants')?.segmentKey;
    } catch (error) {
      expect(error).to.be.undefined;
    }

    expect(segmentKey).to.be.equal(process.env.SEGMENT_KEY);
    expect(testPlaygroundController.segmentKey).to.be.a('string');
  });

  test('get user id from the global storage', () => {
    const testPlaygroundController = new TelemetryController(mockStorageController);

    expect(testPlaygroundController.segmentUserID).to.be.a('string');
  });
});
