import { before, after } from 'mocha';
import chai from 'chai';
import fs from 'fs';
import path from 'path';
import sinon from 'sinon';

import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import CodeActionProvider from '../../../editors/codeActionProvider';
import ConnectionController from '../../../connectionController';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import { ExplorerController } from '../../../explorer';
import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';
import { LanguageServerController } from '../../../language';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { PlaygroundController } from '../../../editors';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import TelemetryService from '../../../telemetry/telemetryService';
import { TestExtensionContext } from '../stubs';

const expect = chai.expect;

chai.use(require('chai-as-promised'));

suite('Language Server Controller Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();

  mockExtensionContext.extensionPath = '../../';

  const mockStorageController = new StorageController(mockExtensionContext);
  const testLanguageServerController = new LanguageServerController(
    mockExtensionContext
  );
  const testTelemetryService = new TelemetryService(
    mockStorageController,
    mockExtensionContext
  );
  const testStatusView = new StatusView(mockExtensionContext);
  const testConnectionController = new ConnectionController(
    testStatusView,
    mockStorageController,
    testTelemetryService
  );
  const testEditDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
    testConnectionController
  );
  const testPlaygroundResultProvider = new PlaygroundResultProvider(
    testConnectionController,
    testEditDocumentCodeLensProvider
  );
  const testActiveDBCodeLensProvider = new ActiveDBCodeLensProvider(
    testConnectionController
  );
  const testExplorerController = new ExplorerController(
    testConnectionController
  );
  const testExportToLanguageCodeLensProvider =
    new ExportToLanguageCodeLensProvider();
  const testCodeActionProvider = new CodeActionProvider();
  const testPlaygroundController = new PlaygroundController(
    testConnectionController,
    testLanguageServerController,
    testTelemetryService,
    testStatusView,
    testPlaygroundResultProvider,
    testActiveDBCodeLensProvider,
    testExportToLanguageCodeLensProvider,
    testCodeActionProvider,
    testExplorerController
  );

  before(async () => {
    await testLanguageServerController.startLanguageServer();

    sinon.replace(
      testConnectionController,
      'getActiveConnectionName',
      () => 'fakeName'
    );
    sinon.replace(
      testConnectionController,
      'getActiveDataService',
      () =>
        ({
          getMongoClientConnectionOptions: () => ({
            url: TEST_DATABASE_URI,
            options: {},
          }),
        } as any)
    );
    sinon.replace(testConnectionController, 'isCurrentlyConnected', () => true);

    await testPlaygroundController._connectToServiceProvider();
  });

  after(() => {
    sinon.restore();
  });

  test('cancel a long-running script', async () => {
    expect(testLanguageServerController._isExecutingInProgress).to.equal(false);

    await testLanguageServerController.executeAll({
      codeToEvaluate: `
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
      `,
      connectionId: 'pineapple',
    });

    testLanguageServerController.cancelAll();
    expect(testLanguageServerController._isExecutingInProgress).to.equal(false);
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
