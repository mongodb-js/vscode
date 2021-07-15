import assert from 'assert';
import { beforeEach } from 'mocha';

import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import CodeActionProvider from '../../../editors/codeActionProvider';
import ConnectionController from '../../../connectionController';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import { ExplorerController } from '../../../explorer';
import { LanguageServerController } from '../../../language';
import { PlaygroundController } from '../../../editors';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { TestExtensionContext, MockLanguageServerController } from '../stubs';

suite('Code Action Provider Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();

  mockExtensionContext.extensionPath = '../../';

  const mockStorageController = new StorageController(mockExtensionContext);
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
  const mockLanguageServerController = new MockLanguageServerController(
    mockExtensionContext,
    mockStorageController
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
  let testPlaygroundController: PlaygroundController;

  beforeEach(() => {
    testPlaygroundController = new PlaygroundController(
      mockExtensionContext,
      testConnectionController,
      mockLanguageServerController as LanguageServerController,
      testTelemetryService,
      testStatusView,
      testPlaygroundResultProvider,
      testActiveDBCodeLensProvider,
      testExplorerController
    );
  });

  test('expected provideCodeActions to return undefined when text is not selected', () => {
    const testCodeActionProvider = new CodeActionProvider(testPlaygroundController);
    const codeActions = testCodeActionProvider.provideCodeActions();

    assert(!codeActions);
  });

  test('expected provideCodeActions to return a run selected playground blocks action', () => {
    const testCodeActionProvider = new CodeActionProvider(testPlaygroundController);
    const codeActions = testCodeActionProvider.provideCodeActions();

    assert(!!codeActions);
    assert(codeActions.length === 1);
  });
});
