import * as vscode from 'vscode';
import { before, beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import fs from 'fs';
import path from 'path';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';
import chaiAsPromised from 'chai-as-promised';

import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import PlaygroundSelectedCodeActionProvider from '../../../editors/playgroundSelectedCodeActionProvider';
import ConnectionController from '../../../connectionController';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';
import { LanguageServerController } from '../../../language';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { PlaygroundController } from '../../../editors';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import TelemetryService from '../../../telemetry/telemetryService';
import { ExtensionContextStub } from '../stubs';

const expect = chai.expect;

chai.use(chaiAsPromised);

suite('Language Server Controller Test Suite', () => {
  const extensionContextStub = new ExtensionContextStub();

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
  );
  const testStatusView = new StatusView(extensionContextStub);
  const testConnectionController = new ConnectionController({
    statusView: testStatusView,
    storageController: testStorageController,
    telemetryService: testTelemetryService,
  });
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
  const testExportToLanguageCodeLensProvider =
    new ExportToLanguageCodeLensProvider();
  const testCodeActionProvider = new PlaygroundSelectedCodeActionProvider();

  let languageServerControllerStub: LanguageServerController;
  let testPlaygroundController: PlaygroundController;

  const sandbox = sinon.createSandbox();

  before(async () => {
    languageServerControllerStub = new LanguageServerController(
      extensionContextStub
    );
    testPlaygroundController = new PlaygroundController({
      connectionController: testConnectionController,
      languageServerController: languageServerControllerStub,
      telemetryService: testTelemetryService,
      statusView: testStatusView,
      playgroundResultViewProvider: testPlaygroundResultProvider,
      activeConnectionCodeLensProvider: testActiveDBCodeLensProvider,
      exportToLanguageCodeLensProvider: testExportToLanguageCodeLensProvider,
      playgroundSelectedCodeActionProvider: testCodeActionProvider,
    });
    await languageServerControllerStub.startLanguageServer();
    await testPlaygroundController._activeConnectionChanged();
  });

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showErrorMessage');
    sandbox.replace(
      testConnectionController,
      'getActiveConnectionName',
      () => 'fakeName'
    );
    sandbox.replace(
      testConnectionController,
      'getActiveDataService',
      () =>
        ({
          getMongoClientConnectionOptions: () => ({
            url: TEST_DATABASE_URI,
            options: {},
          }),
        } as unknown as DataService)
    );
    sandbox.replace(
      testConnectionController,
      'isCurrentlyConnected',
      () => true
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  test('cancel a long-running script', async () => {
    expect(languageServerControllerStub._isExecutingInProgress).to.equal(false);

    await languageServerControllerStub.evaluate({
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

    languageServerControllerStub.cancelAll();
    expect(languageServerControllerStub._isExecutingInProgress).to.equal(false);
  });

  test('the language server dependency bundle exists', async () => {
    const extensionPath = mdbTestExtension.extensionContextStub.extensionPath;
    const languageServerModuleBundlePath = path.join(
      extensionPath,
      'dist',
      'languageServer.js'
    );
    await fs.promises.stat(languageServerModuleBundlePath);
  });
});
