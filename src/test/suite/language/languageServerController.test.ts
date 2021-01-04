import { before, after } from 'mocha';
import TelemetryController from '../../../telemetry/telemetryController';
import DocumentIdStore from '../../../editors/documentIdStore';
import DocumentController from '../../../editors/documentController';

const path = require('path');
const fs = require('fs');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-as-promised'));

import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';

import { TestExtensionContext } from '../stubs';
import { mdbTestExtension } from '../stubbableMdbExtension';

const CONNECTION = {
  driverUrlWithSsh: 'mongodb://localhost:27018',
  driverOptions: {}
};

suite('Language Server Controller Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();

  mockExtensionContext.extensionPath = '../../';

  const mockStorageController = new StorageController(mockExtensionContext);
  const testLanguageServerController = new LanguageServerController(
    mockExtensionContext
  );
  const testTelemetryController = new TelemetryController(
    mockStorageController,
    mockExtensionContext
  );
  const testStatusView = new StatusView(mockExtensionContext);
  const testConnectionController = new ConnectionController(
    testStatusView,
    mockStorageController,
    testTelemetryController
  );
  const testDocumentIdStore = new DocumentIdStore();
  const testDocumentController = new DocumentController(
    testDocumentIdStore,
    testConnectionController,
    testStatusView,
    testTelemetryController
  );

  testLanguageServerController.startLanguageServer();

  const testPlaygroundController = new PlaygroundController(
    mockExtensionContext,
    testConnectionController,
    testLanguageServerController,
    testTelemetryController,
    testStatusView,
    testDocumentController
  );

  before(async () => {
    testConnectionController.getActiveConnectionName = sinon.fake.returns(
      'fakeName'
    );
    testConnectionController.getActiveConnectionModel = sinon.fake.returns({
      appname: 'VSCode Playground Tests',
      port: 27018,
      disconnect: () => {},
      getAttributes: () => CONNECTION
    });

    await testPlaygroundController.connectToServiceProvider();
  });

  after(() => {
    sinon.restore();
  });

  test('cancel a long-running script', async () => {
    testLanguageServerController.executeAll(`
      const names = [
        "flour",
        "butter",
        "water",
        "salt",
        "onions",
        "leek"
      ];
      let currentName = '';
      names.forEach((name) => {
        setTimeout(() => {
          currentName = name;
        }, 500);
      });
      currentName
    `);

    const isDone = await testLanguageServerController.cancelAll();

    expect(isDone).to.be.equal(true);
  });

  test('the language server dependency bundle exists', () => {
    const extensionPath = mdbTestExtension.testExtensionContext.extensionPath;

    const languageServerModuleBundlePath = path.join(
      extensionPath,
      'dist',
      'languageServer.js'
    );

    // eslint-disable-next-line no-sync
    expect(fs.existsSync(languageServerModuleBundlePath)).to.equal(true);
  });
});
