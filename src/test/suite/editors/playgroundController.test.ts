import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import type { DataService } from 'mongodb-data-service';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import chaiAsPromised from 'chai-as-promised';

import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import PlaygroundSelectedCodeActionProvider from '../../../editors/playgroundSelectedCodeActionProvider';
import ConnectionController from '../../../connectionController';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';
import { ExportToLanguageMode } from '../../../types/playgroundType';
import type { LanguageServerController } from '../../../language';
import { PlaygroundController } from '../../../editors';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { ExtensionContextStub, LanguageServerControllerStub } from '../stubs';

const expect = chai.expect;

chai.use(chaiAsPromised);

const mockFileName = path.join(
  'nonexistent',
  `playground-${uuidv4()}.mongodb.js`
);
const mockDocumentUri = vscode.Uri.from({
  path: mockFileName,
  scheme: 'untitled',
});

suite('Playground Controller Test Suite', function () {
  this.timeout(5000);

  const extensionContextStub = new ExtensionContextStub();

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  let testStorageController: StorageController;
  let testTelemetryService: TelemetryService;
  let testStatusView: StatusView;
  let testConnectionController: ConnectionController;
  let testEditDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  let testPlaygroundResultProvider: PlaygroundResultProvider;
  let testActiveDBCodeLensProvider: ActiveDBCodeLensProvider;
  let testExportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;
  let testCodeActionProvider: PlaygroundSelectedCodeActionProvider;
  let languageServerControllerStub: LanguageServerController;
  let testPlaygroundController: PlaygroundController;
  let showErrorMessageStub: SinonStub;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    testStorageController = new StorageController(extensionContextStub);
    testTelemetryService = new TelemetryService(
      testStorageController,
      extensionContextStub
    );
    testStatusView = new StatusView(extensionContextStub);
    testConnectionController = new ConnectionController({
      statusView: testStatusView,
      storageController: testStorageController,
      telemetryService: testTelemetryService,
    });
    testEditDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
      testConnectionController
    );
    testPlaygroundResultProvider = new PlaygroundResultProvider(
      testConnectionController,
      testEditDocumentCodeLensProvider
    );
    testActiveDBCodeLensProvider = new ActiveDBCodeLensProvider(
      testConnectionController
    );
    testExportToLanguageCodeLensProvider =
      new ExportToLanguageCodeLensProvider();
    testCodeActionProvider = new PlaygroundSelectedCodeActionProvider();

    languageServerControllerStub = new LanguageServerControllerStub(
      extensionContextStub,
      testStorageController
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
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
    sandbox.stub(testTelemetryService, 'trackNewConnection');
  });

  afterEach(() => {
    sandbox.restore();
  });

  suite('passing connection details to service provider', () => {
    let fakeConnectToServiceProvider: SinonSpy;

    beforeEach(async () => {
      const mockActiveDataService = {
        getMongoClientConnectionOptions: () => ({
          url: 'mongodb://username@ldaphost:27017/?authMechanism=MONGODB-X509&readPreference=primary&appname=mongodb-vscode+0.0.0-dev.0&ssl=true&authSource=%24external&tlsAllowInvalidCertificates=true&tlsAllowInvalidHostnames=true&tlsCAFile=./path/to/ca&tlsCertificateKeyFile=./path/to/cert',
          options: { monitorCommands: true },
        }),
      } as DataService;

      fakeConnectToServiceProvider = sandbox.fake.resolves(undefined);
      sandbox.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionName',
        () => 'fakeName'
      );
      sandbox.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionId',
        () => 'pineapple'
      );
      sandbox.replace(
        testPlaygroundController._languageServerController,
        'activeConnectionChanged',
        fakeConnectToServiceProvider
      );
      sandbox.stub(vscode.window, 'showInformationMessage');

      testPlaygroundController._connectionController.setActiveDataService(
        mockActiveDataService
      );
      await testPlaygroundController._activeConnectionChanged();
    });

    test('it should pass the active connection id to the language server for connecting', () => {
      expect(
        (
          fakeConnectToServiceProvider.firstCall.firstArg as {
            connectionId: string;
          }
        ).connectionId
      ).to.equal('pineapple');
    });

    test('it should pass ssl strings to the language server for connecting', () => {
      expect(
        (
          fakeConnectToServiceProvider.firstCall.firstArg as {
            connectionString: string;
          }
        ).connectionString
      ).includes('./path/to/cert');
      expect(
        (
          fakeConnectToServiceProvider.firstCall.firstArg as {
            connectionString: string;
          }
        ).connectionString
      ).includes('./path/to/ca');
    });
  });

  suite('playground is not open', () => {
    let showInformationMessageStub: SinonStub;

    beforeEach(() => {
      testPlaygroundController._activeTextEditor = undefined;

      showInformationMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
    });

    test('run all playground tells to open a playground file', async () => {
      const expectedMessage =
        'Please open a MongoDB playground file before running it.';
      await testPlaygroundController.runAllPlaygroundBlocks();
      expect(showErrorMessageStub.firstCall.args[0]).to.be.equal(
        expectedMessage
      );
    });

    test('run selected playground blocks tells to select one or more lines in the playground', async () => {
      const expectedMessage =
        'Please select one or more lines in the playground.';
      await testPlaygroundController.runSelectedPlaygroundBlocks();
      expect(showInformationMessageStub.firstCall.args[0]).to.be.equal(
        expectedMessage
      );
    });

    test('run all or selected playground blocks tells to select one or more lines in the playground', async () => {
      const expectedMessage =
        'Please open a MongoDB playground file before running it.';
      await testPlaygroundController.runAllOrSelectedPlaygroundBlocks();
      expect(showErrorMessageStub.firstCall.args[0]).to.be.equal(
        expectedMessage
      );
    });
  });

  suite('playground is open', () => {
    let mockActiveTestEditor;
    let showInformationMessageStub: SinonStub;

    beforeEach(() => {
      mockActiveTestEditor = {
        document: {
          languageId: 'javascript',
          uri: mockDocumentUri,
          getText: () => "use('dbName');",
          lineAt: () => ({ text: "use('dbName');" }),
        },
        selections: [
          new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(0, 0)
          ),
        ],
      };

      testPlaygroundController._activeTextEditor =
        mockActiveTestEditor as vscode.TextEditor;
      testPlaygroundController._selectedText = undefined;
      showInformationMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
    });

    suite('user is not connected', () => {
      beforeEach(() => {
        sandbox.replace(
          testPlaygroundController._connectionController,
          'isCurrentlyConnected',
          () => false
        );
      });

      test('run all playground blocks shows please connect to a database error', async () => {
        const expectedMessage =
          'Please connect to a database before running a playground.';
        await testPlaygroundController.runAllPlaygroundBlocks();
        expect(showErrorMessageStub.firstCall.args[0]).to.be.equal(
          expectedMessage
        );
      });

      test('run selected playground blocks shows please connect to a database error', async () => {
        testPlaygroundController._selectedText = '{}';
        const expectedMessage =
          'Please connect to a database before running a playground.';
        await testPlaygroundController.runSelectedPlaygroundBlocks();
        expect(showErrorMessageStub.firstCall.args[0]).to.be.equal(
          expectedMessage
        );
      });

      test('run all or selected playground blocks shows please connect to a database error', async () => {
        testPlaygroundController._selectedText = '{}';
        const expectedMessage =
          'Please connect to a database before running a playground.';
        await testPlaygroundController.runAllOrSelectedPlaygroundBlocks();
        expect(showErrorMessageStub.firstCall.args[0]).to.be.equal(
          expectedMessage
        );
      });
    });

    suite('user is connected', () => {
      let showTextDocumentStub: SinonStub;

      beforeEach(async () => {
        sandbox.replace(
          testPlaygroundController._connectionController,
          'getActiveConnectionName',
          () => 'fakeName'
        );
        sandbox.replace(
          testPlaygroundController._connectionController,
          'isCurrentlyConnected',
          () => true
        );
        sandbox.replace(
          testPlaygroundController._connectionController,
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
          testPlaygroundController._connectionController,
          'getActiveConnectionId',
          () => 'pineapple'
        );
        showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument');

        await testPlaygroundController._activeConnectionChanged();
      });

      test('keep a playground in focus after running it', async () => {
        await testPlaygroundController._showResultAsVirtualDocument();

        const showTextDocumentOptions = showTextDocumentStub.getCall(0).lastArg;
        expect(showTextDocumentOptions.preview).to.be.equal(false);
        expect(showTextDocumentOptions.preserveFocus).to.be.equal(true);
        expect(showTextDocumentOptions.viewColumn).to.be.equal(-2);
      });

      test('close cancelation modal when a playground is canceled', async () => {
        sandbox.replace(
          testPlaygroundController,
          '_evaluate',
          sandbox.fake.rejects(false)
        );

        const result =
          await testPlaygroundController._evaluateWithCancelModal();

        expect(result).to.deep.equal({ result: undefined });
      });

      test('playground controller loads the active editor on start', () => {
        sandbox.replaceGetter(
          vscode.window,
          'activeTextEditor',
          () => mockActiveTestEditor as vscode.TextEditor
        );

        const playgroundController = new PlaygroundController({
          connectionController: testConnectionController,
          languageServerController: languageServerControllerStub,
          telemetryService: testTelemetryService,
          statusView: testStatusView,
          playgroundResultViewProvider: testPlaygroundResultProvider,
          activeConnectionCodeLensProvider: testActiveDBCodeLensProvider,
          exportToLanguageCodeLensProvider:
            testExportToLanguageCodeLensProvider,
          playgroundSelectedCodeActionProvider: testCodeActionProvider,
        });

        expect(playgroundController._activeTextEditor).to.deep.equal(
          mockActiveTestEditor
        );
      });

      test('exportToLanguage thrown an error for invalid syntax', async () => {
        const playgroundController = new PlaygroundController({
          connectionController: testConnectionController,
          languageServerController: languageServerControllerStub,
          telemetryService: testTelemetryService,
          statusView: testStatusView,
          playgroundResultViewProvider: testPlaygroundResultProvider,
          activeConnectionCodeLensProvider: testActiveDBCodeLensProvider,
          exportToLanguageCodeLensProvider:
            testExportToLanguageCodeLensProvider,
          playgroundSelectedCodeActionProvider: testCodeActionProvider,
        });
        const textFromEditor = 'var x = { name: qwerty }';
        const selection = {
          start: { line: 0, character: 8 },
          end: { line: 0, character: 24 },
        } as vscode.Selection;
        const mode = ExportToLanguageMode.OTHER;
        const activeTextEditor = {
          document: { getText: () => textFromEditor },
        } as vscode.TextEditor;

        playgroundController._selectedText = '{ name: qwerty }';
        playgroundController._playgroundSelectedCodeActionProvider.selection =
          selection;
        playgroundController._playgroundSelectedCodeActionProvider.mode = mode;
        playgroundController._activeTextEditor = activeTextEditor;

        await playgroundController.exportToLanguage('csharp');

        const expectedMessage =
          "Unable to export to csharp language: Symbol 'qwerty' is undefined";
        expect(showErrorMessageStub.firstCall.args[0]).to.equal(
          expectedMessage
        );
      });

      suite('output channels', () => {
        let outputChannelAppendLineStub: SinonStub;
        let outputChannelClearStub: SinonStub;
        let outputChannelShowStub: SinonStub;

        beforeEach(function () {
          outputChannelAppendLineStub = sandbox.stub();
          outputChannelClearStub = sandbox.stub();
          outputChannelShowStub = sandbox.stub();

          const mockOutputChannel = {
            appendLine: outputChannelAppendLineStub,
            clear: outputChannelClearStub,
            show: outputChannelShowStub,
          } as Partial<vscode.OutputChannel> as unknown as vscode.OutputChannel;
          sandbox.replace(
            testPlaygroundController,
            '_outputChannel',
            mockOutputChannel
          );
          showInformationMessageStub.resolves('Yes');
        });

        test('clear output channel when evaluating', async () => {
          sandbox.replace(
            testPlaygroundController,
            '_evaluateWithCancelModal',
            sandbox.stub().resolves({
              result: '123',
            })
          );

          expect(outputChannelClearStub).to.not.be.called;

          await testPlaygroundController.runAllPlaygroundBlocks();

          expect(outputChannelClearStub).to.be.calledOnce;
        });
      });

      suite('confirmation modal', () => {
        beforeEach(function () {
          sandbox.replace(
            testPlaygroundController,
            '_evaluateWithCancelModal',
            sandbox.stub().resolves({ result: '123' })
          );
          sandbox.replace(
            testPlaygroundController,
            '_openPlaygroundResult',
            sandbox.stub()
          );
        });

        test('show a confirmation message if mdb.confirmRunAll is true', async () => {
          showInformationMessageStub.resolves('Yes');

          await vscode.workspace
            .getConfiguration('mdb')
            .update('confirmRunAll', true);

          const result =
            await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.equal(true);
          expect(showInformationMessageStub).to.have.been.calledOnce;
        });

        test('do not show a confirmation message if mdb.confirmRunAll is false', async () => {
          showInformationMessageStub.resolves('Yes');

          await vscode.workspace
            .getConfiguration('mdb')
            .update('confirmRunAll', false);

          const result =
            await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.equal(true);
          expect(showInformationMessageStub).to.not.have.been.called;
        });

        test('do not run a playground if user selected No in the confirmation message', async () => {
          showInformationMessageStub.resolves('No');

          await vscode.workspace
            .getConfiguration('mdb')
            .update('confirmRunAll', true);

          const result =
            await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.false;
        });
      });
    });
  });
});
