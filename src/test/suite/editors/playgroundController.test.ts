import * as vscode from 'vscode';
import { before, beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';

import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import CodeActionProvider from '../../../editors/codeActionProvider';
import ConnectionController from '../../../connectionController';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import { ExplorerController } from '../../../explorer';
import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';
import { ExportToLanguageMode } from '../../../types/playgroundType';
import { LanguageServerController } from '../../../language';
import { PlaygroundController } from '../../../editors';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { TestExtensionContext, MockLanguageServerController } from '../stubs';

const expect = chai.expect;

chai.use(require('chai-as-promised'));

suite('Playground Controller Test Suite', function () {
  this.timeout(5000);

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
  const testExportToLanguageCodeLensProvider = new ExportToLanguageCodeLensProvider();
  const testCodeActionProvider = new CodeActionProvider();
  const testExplorerController = new ExplorerController(
    testConnectionController
  );
  const testPlaygroundController = new PlaygroundController(
    testConnectionController,
    mockLanguageServerController as LanguageServerController,
    testTelemetryService,
    testStatusView,
    testPlaygroundResultProvider,
    testActiveDBCodeLensProvider,
    testExportToLanguageCodeLensProvider,
    testCodeActionProvider,
    testExplorerController
  );
  const sandbox = sinon.createSandbox();
  let fakeShowInformationMessage: sinon.SinonStub;

  beforeEach(() => {
    fakeShowInformationMessage = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  suite('passing connection details to service provider', () => {
    let mockConnectToServiceProvider: sinon.SinonSpy;

    beforeEach(async () => {
      const mockGetActiveConnectionName = sinon.fake.returns('fakeName');
      const mockGetActiveDataService = sinon.fake.returns({
        getMongoClientConnectionOptions: () => ({
          url: 'mongodb://username@ldaphost:27017/?authMechanism=MONGODB-X509&readPreference=primary&appname=mongodb-vscode+0.0.0-dev.0&ssl=true&authSource=%24external&tlsAllowInvalidCertificates=true&tlsAllowInvalidHostnames=true&tlsCAFile=./path/to/ca&tlsCertificateKeyFile=./path/to/cert',
          options: { monitorCommands: true }
        })
      });
      const mockGetActiveConnectionId = sinon.fake.returns('pineapple');
      mockConnectToServiceProvider = sinon.fake.resolves(undefined);

      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionName',
        mockGetActiveConnectionName
      );
      sinon.replace(
        testPlaygroundController._connectionController,
        'isCurrentlyConnected',
        () => true
      );
      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveDataService',
        mockGetActiveDataService
      );
      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionId',
        mockGetActiveConnectionId
      );
      sinon.replace(
        testPlaygroundController._languageServerController,
        'connectToServiceProvider',
        mockConnectToServiceProvider
      );

      await testPlaygroundController._connectToServiceProvider();
    });

    test('it should pass the active connection id to the language server for connecting', () => {
      expect(
        (mockConnectToServiceProvider.firstCall.firstArg as {
          connectionId: string;
        }).connectionId
      ).to.equal('pineapple');
    });

    test('it should pass ssl strings to the language server for connecting', () => {
      expect(
        (mockConnectToServiceProvider.firstCall.firstArg as {
          connectionString: string
        }).connectionString
      ).includes('./path/to/cert');
      expect(
        (mockConnectToServiceProvider.firstCall.firstArg as {
          connectionString: string
        }).connectionString
      ).includes('./path/to/ca');
    });
  });

  suite('playground is not open', () => {
    testPlaygroundController._activeTextEditor = undefined;

    test('run all playground blocks should throw the playground not found error', async () => {
      const expectedMessage = "Please open a '.mongodb' playground file before running it.";
      const fakeShowErrorMessage: any = sinon.fake();
      sinon.replace(
        vscode.window,
        'showErrorMessage',
        fakeShowErrorMessage
      );

      try {
        await testPlaygroundController.runAllPlaygroundBlocks();
      } catch (error) {
        expect(fakeShowErrorMessage.firstArg).to.be.equal(expectedMessage);
      }
    });

    test('run selected playground blocks should throw the playground not found error', async () => {
      const expectedMessage = "Please open a '.mongodb' playground file before running it.";
      const fakeShowErrorMessage: any = sinon.fake();
      sinon.replace(
        vscode.window,
        'showErrorMessage',
        fakeShowErrorMessage
      );

      try {
        await testPlaygroundController.runSelectedPlaygroundBlocks();
      } catch (error) {
        expect(fakeShowErrorMessage.firstArg).to.be.equal(expectedMessage);
      }
    });

    test('run all or selected playground blocks should throw the playground not found error', async () => {
      const expectedMessage = "Please open a '.mongodb' playground file before running it.";
      const fakeShowErrorMessage: any = sinon.fake();
      sinon.replace(
        vscode.window,
        'showErrorMessage',
        fakeShowErrorMessage
      );

      try {
        await testPlaygroundController.runAllOrSelectedPlaygroundBlocks();
      } catch (error) {
        expect(fakeShowErrorMessage.firstArg).to.be.equal(expectedMessage);
      }
    });
  });

  suite('playground is open', () => {
    const activeTestEditorMock: unknown = {
      document: {
        languageId: 'mongodb',
        uri: {
          path: 'test'
        },
        getText: () => "use('dbName');",
        lineAt: sinon.fake.returns({ text: "use('dbName');" })
      },
      selections: [
        new vscode.Selection(
          new vscode.Position(0, 0),
          new vscode.Position(0, 0)
        )
      ]
    };

    beforeEach(() => {
      testPlaygroundController._activeTextEditor = activeTestEditorMock as vscode.TextEditor;
    });

    suite('user is not connected', () => {
      before(() => {
        const mockGetActiveConnectionName = sinon.fake.returns('');

        sinon.replace(
          testPlaygroundController._connectionController,
          'getActiveConnectionName',
          mockGetActiveConnectionName
        );
      });

      test('run all playground blocks should throw the error', async () => {
        const expectedMessage = 'Please connect to a database before running a playground.';
        const fakeShowErrorMessage: any = sinon.fake();
        sinon.replace(
          vscode.window,
          'showErrorMessage',
          fakeShowErrorMessage
        );

        try {
          await testPlaygroundController.runAllPlaygroundBlocks();
        } catch (error) {
          expect(fakeShowErrorMessage.firstArg).to.be.equal(expectedMessage);
        }
      });

      test('run selected playground blocks should throw the error', async () => {
        const expectedMessage = 'Please connect to a database before running a playground.';
        const fakeShowErrorMessage: any = sinon.fake();
        sinon.replace(
          vscode.window,
          'showErrorMessage',
          fakeShowErrorMessage
        );

        try {
          await testPlaygroundController.runSelectedPlaygroundBlocks();
        } catch (error) {
          expect(fakeShowErrorMessage.firstArg).to.be.equal(expectedMessage);
        }
      });

      test('run all or selected playground blocks should throw the error', async () => {
        const expectedMessage = 'Please connect to a database before running a playground.';
        const fakeShowErrorMessage: any = sinon.fake();
        sinon.replace(
          vscode.window,
          'showErrorMessage',
          fakeShowErrorMessage
        );

        try {
          await testPlaygroundController.runAllOrSelectedPlaygroundBlocks();
        } catch (error) {
          expect(fakeShowErrorMessage.firstArg).to.be.equal(expectedMessage);
        }
      });
    });

    suite('user is connected', () => {
      beforeEach(async () => {
        const mockGetActiveConnectionName = sinon.fake.returns('fakeName');
        const mockGetActiveDataService = sinon.fake.returns({
          getMongoClientConnectionOptions: () => ({
            url: TEST_DATABASE_URI,
            options: {}
          })
        });
        const mockGetActiveConnectionId = sinon.fake.returns('pineapple');

        sinon.replace(
          testPlaygroundController._connectionController,
          'getActiveConnectionName',
          mockGetActiveConnectionName
        );
        sinon.replace(
          testPlaygroundController._connectionController,
          'isCurrentlyConnected',
          () => true
        );
        sinon.replace(
          testPlaygroundController._connectionController,
          'getActiveDataService',
          mockGetActiveDataService
        );
        sinon.replace(
          testPlaygroundController._connectionController,
          'getActiveConnectionId',
          mockGetActiveConnectionId
        );

        await testPlaygroundController._connectToServiceProvider();
      });

      test('keep a playground in focus after running it', async () => {
        const mockShowTextDocument: any = sinon.fake();
        sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

        await testPlaygroundController._showResultAsVirtualDocument();

        const showTextDocumentOptions = mockShowTextDocument.lastArg;

        expect(showTextDocumentOptions.preview).to.be.equal(false);
        expect(showTextDocumentOptions.preserveFocus).to.be.equal(true);
        expect(showTextDocumentOptions.viewColumn).to.be.equal(-2);
      });

      test('show a confirmation message if mdb.confirmRunAll is true', async () => {
        fakeShowInformationMessage.resolves('Yes');

        const mockEvaluateWithCancelModal = sinon.fake.resolves({
          outputLines: [],
          result: '123'
        });
        sinon.replace(
          testPlaygroundController,
          '_evaluateWithCancelModal',
          mockEvaluateWithCancelModal
        );

        const mockOpenPlaygroundResult = sinon.fake();
        sinon.replace(
          testPlaygroundController,
          '_openPlaygroundResult',
          mockOpenPlaygroundResult
        );

        const result = await testPlaygroundController.runAllPlaygroundBlocks();

        expect(result).to.be.equal(true);
        sinon.assert.called(fakeShowInformationMessage);
      });

      test('do not show a confirmation message if mdb.confirmRunAll is false', async () => {
        fakeShowInformationMessage.resolves('Yes');

        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);

        const mockEvaluateWithCancelModal = sinon.fake.resolves({
          outputLines: [],
          result: '123'
        });
        sinon.replace(
          testPlaygroundController,
          '_evaluateWithCancelModal',
          mockEvaluateWithCancelModal
        );

        const mockOpenPlaygroundResult = sinon.fake();
        sinon.replace(
          testPlaygroundController,
          '_openPlaygroundResult',
          mockOpenPlaygroundResult
        );

        const result = await testPlaygroundController.runAllPlaygroundBlocks();

        expect(result).to.be.equal(true);
        sinon.assert.notCalled(fakeShowInformationMessage);
      });

      test('do not run a playground if user selected No in the confirmation message', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', true);

        fakeShowInformationMessage.resolves('No');

        const result = await testPlaygroundController.runAllPlaygroundBlocks();

        expect(result).to.be.false;
      });

      test('close cancelation modal when a playground is canceled', async () => {
        sinon.replace(
          testPlaygroundController,
          '_evaluate',
          sinon.fake.rejects(false)
        );

        const result = await testPlaygroundController._evaluateWithCancelModal();

        expect(result).to.deep.equal({
          outputLines: undefined,
          result: undefined
        });
      });

      test('playground controller loads the active editor on start', () => {
        sandbox.replaceGetter(
          vscode.window,
          'activeTextEditor',
          () => activeTestEditorMock as vscode.TextEditor
        );

        const testExplorerController = new ExplorerController(
          testConnectionController
        );
        const playgroundControllerTest = new PlaygroundController(
          testConnectionController,
          mockLanguageServerController as LanguageServerController,
          testTelemetryService,
          testStatusView,
          testPlaygroundResultProvider,
          testActiveDBCodeLensProvider,
          testExportToLanguageCodeLensProvider,
          testCodeActionProvider,
          testExplorerController
        );

        expect(playgroundControllerTest._activeTextEditor).to.deep.equal(
          activeTestEditorMock
        );
      });

      test('exportToLanguage thrown an error for invalid syntax', async () => {
        const testExplorerController = new ExplorerController(
          testConnectionController
        );
        const playgroundControllerTest = new PlaygroundController(
          testConnectionController,
          mockLanguageServerController as LanguageServerController,
          testTelemetryService,
          testStatusView,
          testPlaygroundResultProvider,
          testActiveDBCodeLensProvider,
          testExportToLanguageCodeLensProvider,
          testCodeActionProvider,
          testExplorerController
        );
        const textFromEditor = 'var x = { name: qwerty }';
        const selection = {
          start: { line: 0, character: 8 },
          end: { line: 0, character: 24 }
        } as vscode.Selection;
        const mode = ExportToLanguageMode.OTHER;
        const activeTextEditor = { document: { getText: () => textFromEditor } } as vscode.TextEditor;

        const fakeVscodeErrorMessage: any = sinon.fake();
        sinon.replace(
          vscode.window,
          'showErrorMessage',
          fakeVscodeErrorMessage
        );

        playgroundControllerTest._selectedText = '{ name: qwerty }';
        playgroundControllerTest._codeActionProvider.selection = selection;
        playgroundControllerTest._codeActionProvider.mode = mode;
        playgroundControllerTest._activeTextEditor = activeTextEditor;

        await playgroundControllerTest.exportToLanguage('csharp');

        const expectedMessage = 'Unable to export to csharp language: Symbol \'qwerty\' is undefined';
        expect(fakeVscodeErrorMessage.firstArg).to.be.equal(expectedMessage);
      });
    });
  });
});
