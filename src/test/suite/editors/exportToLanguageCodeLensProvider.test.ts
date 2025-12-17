import { beforeEach } from 'mocha';
import chai from 'chai';

import ExportToLanguageCodeLensProvider, {
  DEFAULT_EXPORT_TO_LANGUAGE_DRIVER_SYNTAX,
} from '../../../editors/exportToLanguageCodeLensProvider';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import StorageController from '../../../storage/storageController';
import { ExtensionContextStub } from '../stubs';
import { TelemetryService } from '../../../telemetry';
import StatusView from '../../../views/statusView';
import ConnectionController from '../../../connectionController';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';

const expect = chai.expect;

const DEFAULT_EXPORT_TO_LANGUAGE_RESULT = {
  content: '123',
  prompt: '123',
  includeDriverSyntax: DEFAULT_EXPORT_TO_LANGUAGE_DRIVER_SYNTAX,
  language: 'shell',
};

suite('Export To Language Code Lens Provider Test Suite', function () {
  let testExportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;
  let testPlaygroundResultProvider: PlaygroundResultProvider;
  let testStorageController: StorageController;
  let testTelemetryService: TelemetryService;
  let testStatusView: StatusView;
  let testConnectionController: ConnectionController;
  let testEditDocumentCodeLensProvider: EditDocumentCodeLensProvider;

  const extensionContextStub = new ExtensionContextStub();

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  beforeEach(() => {
    testStorageController = new StorageController(extensionContextStub);
    testTelemetryService = new TelemetryService(
      testStorageController,
      extensionContextStub,
    );
    testStatusView = new StatusView(extensionContextStub);
    testConnectionController = new ConnectionController({
      statusView: testStatusView,
      storageController: testStorageController,
      telemetryService: testTelemetryService,
    });
    testEditDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController,
    );
    testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider,
    );
    testExportToLanguageCodeLensProvider = new ExportToLanguageCodeLensProvider(
      testPlaygroundResultProvider,
    );
  });

  test('renders the exclude driver syntax code lens by default for shell', function () {
    testPlaygroundResultProvider.setPlaygroundResult(
      DEFAULT_EXPORT_TO_LANGUAGE_RESULT,
    );

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses).to.exist;
    if (codeLenses) {
      expect(codeLenses.length).to.be.equal(1);
      expect(codeLenses[0].command?.title).to.be.equal('Exclude Driver Syntax');
    }
  });

  test('renders the include driver syntax code lens when includeDriverSyntax is false for shell', function () {
    testPlaygroundResultProvider.setPlaygroundResult({
      ...DEFAULT_EXPORT_TO_LANGUAGE_RESULT,
      includeDriverSyntax: false,
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses).to.exist;
    if (codeLenses) {
      expect(codeLenses.length).to.be.equal(1);
      expect(codeLenses[0].command?.title).to.be.equal('Include Driver Syntax');
    }
  });

  test('renders the exclude driver syntax code lens when includeDriverSyntax is true for shell', function () {
    testPlaygroundResultProvider.setPlaygroundResult({
      ...DEFAULT_EXPORT_TO_LANGUAGE_RESULT,
      includeDriverSyntax: true,
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses).to.exist;
    if (codeLenses) {
      expect(codeLenses.length).to.be.equal(1);
      expect(codeLenses[0].command?.title).to.be.equal('Exclude Driver Syntax');
    }
  });

  test('does not render code lenses for csharp', function () {
    testPlaygroundResultProvider.setPlaygroundResult({
      ...DEFAULT_EXPORT_TO_LANGUAGE_RESULT,
      language: 'csharp',
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses?.length).to.be.equal(0); // Csharp does not support driver syntax.
  });

  test('does not render code lenses for json text', function () {
    testPlaygroundResultProvider.setPlaygroundResult({
      ...DEFAULT_EXPORT_TO_LANGUAGE_RESULT,
      language: 'json',
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses).to.not.exist;
  });

  test('does not render code lenses for plain text text', function () {
    testPlaygroundResultProvider.setPlaygroundResult({
      ...DEFAULT_EXPORT_TO_LANGUAGE_RESULT,
      language: 'plaintext',
    });

    const codeLenses = testExportToLanguageCodeLensProvider.provideCodeLenses();
    expect(codeLenses).to.not.exist;
  });
});
