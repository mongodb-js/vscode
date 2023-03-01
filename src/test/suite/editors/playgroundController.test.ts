import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import type { DataService } from 'mongodb-data-service';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import PlaygroundSelectedCodeActionProvider from '../../../editors/playgroundSelectedCodeActionProvider';
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
import { ExtensionContextStub, LanguageServerControllerStub } from '../stubs';

const expect = chai.expect;

chai.use(require('chai-as-promised'));

suite('Playground Controller Test Suite', function () {
  this.timeout(5000);

  const extensionContextStub = new ExtensionContextStub();

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
  );
  const testStatusView = new StatusView(extensionContextStub);
  const testConnectionController = new ConnectionController(
    testStatusView,
    testStorageController,
    testTelemetryService
  );
  const languageServerControllerStub = new LanguageServerControllerStub(
    extensionContextStub,
    testStorageController
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
  const testExportToLanguageCodeLensProvider =
    new ExportToLanguageCodeLensProvider();
  const testCodeActionProvider = new PlaygroundSelectedCodeActionProvider();
  const testExplorerController = new ExplorerController(
    testConnectionController
  );
  const testPlaygroundController = new PlaygroundController(
    testConnectionController,
    languageServerControllerStub as LanguageServerController,
    testTelemetryService,
    testStatusView,
    testPlaygroundResultProvider,
    testActiveDBCodeLensProvider,
    testExportToLanguageCodeLensProvider,
    testCodeActionProvider,
    testExplorerController
  );
  const sandbox = sinon.createSandbox();
  let showErrorMessageStub: SinonStub;

  beforeEach(() => {
    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  suite('passing connection details to service provider', () => {
    let fakeConnectToServiceProvider: SinonSpy;

    beforeEach(async () => {
      const fakeGetActiveConnectionName = sinon.fake.returns('fakeName');
      const mockActiveDataService = {
        getMongoClientConnectionOptions: () => ({
          url: 'mongodb://username@ldaphost:27017/?authMechanism=MONGODB-X509&readPreference=primary&appname=mongodb-vscode+0.0.0-dev.0&ssl=true&authSource=%24external&tlsAllowInvalidCertificates=true&tlsAllowInvalidHostnames=true&tlsCAFile=./path/to/ca&tlsCertificateKeyFile=./path/to/cert',
          options: { monitorCommands: true },
        }),
      } as DataService;
      const fakeGetActiveConnectionId = sinon.fake.returns('pineapple');
      fakeConnectToServiceProvider = sinon.fake.resolves(undefined);

      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionName',
        fakeGetActiveConnectionName
      );
      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionId',
        fakeGetActiveConnectionId
      );
      sinon.replace(
        testPlaygroundController._languageServerController,
        'connectToServiceProvider',
        fakeConnectToServiceProvider
      );
      sinon.stub(vscode.window, 'showInformationMessage');

      testPlaygroundController._connectionController.setActiveDataService(
        mockActiveDataService
      );
      await testPlaygroundController._connectToServiceProvider();
    });

    afterEach(() => {
      sinon.restore();
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
    testPlaygroundController._activeTextEditor = undefined;

    beforeEach(() => {
      showInformationMessageStub = sinon.stub(
        vscode.window,
        'showInformationMessage'
      );
    });

    afterEach(() => {
      sinon.restore();
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
    const fileName = path.join(
      'nonexistent',
      `playground-${uuidv4()}.mongodb.js`
    );
    const documentUri = vscode.Uri.from({ path: fileName, scheme: 'untitled' });
    const mockActiveTestEditor: unknown = {
      document: {
        languageId: 'javascript',
        uri: documentUri,
        getText: () => "use('dbName');",
        lineAt: sinon.fake.returns({ text: "use('dbName');" }),
      },
      selections: [
        new vscode.Selection(
          new vscode.Position(0, 0),
          new vscode.Position(0, 0)
        ),
      ],
    };

    beforeEach(() => {
      testPlaygroundController._activeTextEditor =
        mockActiveTestEditor as vscode.TextEditor;
      testPlaygroundController._selectedText = undefined;
      sinon.stub(vscode.window, 'showInformationMessage');
    });

    afterEach(() => {
      sinon.restore();
    });

    suite('user is not connected', () => {
      beforeEach(() => {
        sinon.replace(
          testPlaygroundController._connectionController,
          'isCurrentlyConnected',
          sinon.fake.returns(false)
        );
      });

      afterEach(() => {
        sinon.restore();
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
        const fakeGetActiveConnectionName = sinon.fake.returns('fakeName');
        const fakeGetActiveDataService = sinon.fake.returns({
          getMongoClientConnectionOptions: () => ({
            url: TEST_DATABASE_URI,
            options: {},
          }),
        });
        const fakeGetActiveConnectionId = sinon.fake.returns('pineapple');

        sinon.replace(
          testPlaygroundController._connectionController,
          'getActiveConnectionName',
          fakeGetActiveConnectionName
        );
        sinon.replace(
          testPlaygroundController._connectionController,
          'isCurrentlyConnected',
          sinon.fake.returns(true)
        );
        sinon.replace(
          testPlaygroundController._connectionController,
          'getActiveDataService',
          fakeGetActiveDataService
        );
        sinon.replace(
          testPlaygroundController._connectionController,
          'getActiveConnectionId',
          fakeGetActiveConnectionId
        );
        showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument');

        await testPlaygroundController._connectToServiceProvider();
      });

      afterEach(() => {
        sinon.restore();
      });

      test('keep a playground in focus after running it', async () => {
        await testPlaygroundController._showResultAsVirtualDocument();

        const showTextDocumentOptions = showTextDocumentStub.getCall(0).lastArg;
        expect(showTextDocumentOptions.preview).to.be.equal(false);
        expect(showTextDocumentOptions.preserveFocus).to.be.equal(true);
        expect(showTextDocumentOptions.viewColumn).to.be.equal(-2);
      });

      test('close cancelation modal when a playground is canceled', async () => {
        sinon.replace(
          testPlaygroundController,
          '_evaluate',
          sinon.fake.rejects(false)
        );

        const result =
          await testPlaygroundController._evaluateWithCancelModal();

        expect(result).to.deep.equal({
          outputLines: undefined,
          result: undefined,
        });
      });

      test('it shows an error message and restarts, and connects the language server when an error occurs in executeAll (out of memory can cause this)', async () => {
        const mockConnectionDisposedError = new Error(
          'Pending response rejected since connection got disposed'
        );
        (mockConnectionDisposedError as any).code = -32097;
        sinon
          .stub(languageServerControllerStub, 'executeAll')
          .rejects(mockConnectionDisposedError);

        const stubStartLanguageServer = sinon
          .stub(languageServerControllerStub, 'startLanguageServer')
          .resolves();

        const stubConnectToServiceProvider = sinon
          .stub(testPlaygroundController, '_connectToServiceProvider')
          .resolves();

        try {
          await testPlaygroundController._evaluate('console.log("test");');

          // It should have thrown in the above evaluation.
          expect(true).to.equal(false);
        } catch (error) {
          expect((<any>error).message).to.equal(
            'Pending response rejected since connection got disposed'
          );
          expect((<any>error).code).to.equal(-32097);
        }

        expect(showErrorMessageStub.calledOnce).to.equal(true);
        expect(showErrorMessageStub.firstCall.args[0]).to.equal(
          'An error occurred when running the playground. This can occur when the playground runner runs out of memory.'
        );

        expect(stubStartLanguageServer.calledOnce).to.equal(true);
        expect(stubConnectToServiceProvider.calledOnce).to.equal(true);
      });

      test('playground controller loads the active editor on start', () => {
        sandbox.replaceGetter(
          vscode.window,
          'activeTextEditor',
          () => mockActiveTestEditor as vscode.TextEditor
        );

        const testExplorerController = new ExplorerController(
          testConnectionController
        );
        const playgroundControllerTest = new PlaygroundController(
          testConnectionController,
          languageServerControllerStub as LanguageServerController,
          testTelemetryService,
          testStatusView,
          testPlaygroundResultProvider,
          testActiveDBCodeLensProvider,
          testExportToLanguageCodeLensProvider,
          testCodeActionProvider,
          testExplorerController
        );

        expect(playgroundControllerTest._activeTextEditor).to.deep.equal(
          mockActiveTestEditor
        );
      });

      test('exportToLanguage thrown an error for invalid syntax', async () => {
        const testExplorerController = new ExplorerController(
          testConnectionController
        );
        const playgroundControllerTest = new PlaygroundController(
          testConnectionController,
          languageServerControllerStub as LanguageServerController,
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
          end: { line: 0, character: 24 },
        } as vscode.Selection;
        const mode = ExportToLanguageMode.OTHER;
        const activeTextEditor = {
          document: { getText: () => textFromEditor },
        } as vscode.TextEditor;

        playgroundControllerTest._selectedText = '{ name: qwerty }';
        playgroundControllerTest._playgroundSelectedCodeActionProvider.selection =
          selection;
        playgroundControllerTest._playgroundSelectedCodeActionProvider.mode =
          mode;
        playgroundControllerTest._activeTextEditor = activeTextEditor;

        await playgroundControllerTest.exportToLanguage('csharp');

        const expectedMessage =
          "Unable to export to csharp language: Symbol 'qwerty' is undefined";
        expect(showErrorMessageStub.firstCall.args[0]).to.equal(
          expectedMessage
        );
      });
    });
  });

  suite('confirmation modal', () => {
    let showInformationMessageStub: SinonStub;

    beforeEach(() => {
      showInformationMessageStub = sinon.stub(
        vscode.window,
        'showInformationMessage'
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('show a confirmation message if mdb.confirmRunAll is true', async () => {
      showInformationMessageStub.resolves('Yes');

      const fakeEvaluateWithCancelModal = sinon.fake.resolves({
        outputLines: [],
        result: '123',
      });
      sinon.replace(
        testPlaygroundController,
        '_evaluateWithCancelModal',
        fakeEvaluateWithCancelModal
      );

      const fakeOpenPlaygroundResult = sinon.fake();
      sinon.replace(
        testPlaygroundController,
        '_openPlaygroundResult',
        fakeOpenPlaygroundResult
      );

      const result = await testPlaygroundController.runAllPlaygroundBlocks();

      expect(result).to.be.equal(true);
      sinon.assert.called(showInformationMessageStub);
    });

    test('do not show a confirmation message if mdb.confirmRunAll is false', async () => {
      showInformationMessageStub.resolves('Yes');

      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', false);

      const fakeEvaluateWithCancelModal = sinon.fake.resolves({
        outputLines: [],
        result: '123',
      });
      sinon.replace(
        testPlaygroundController,
        '_evaluateWithCancelModal',
        fakeEvaluateWithCancelModal
      );

      const fakeOpenPlaygroundResult = sinon.fake();
      sinon.replace(
        testPlaygroundController,
        '_openPlaygroundResult',
        fakeOpenPlaygroundResult
      );

      const result = await testPlaygroundController.runAllPlaygroundBlocks();

      expect(result).to.be.equal(true);
      sinon.assert.notCalled(showInformationMessageStub);
    });

    test('do not run a playground if user selected No in the confirmation message', async () => {
      showInformationMessageStub.resolves('No');

      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', true);

      const result = await testPlaygroundController.runAllPlaygroundBlocks();

      expect(result).to.be.false;
    });
  });
});
