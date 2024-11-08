import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import type { DataService } from 'mongodb-data-service';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import PlaygroundSelectionCodeActionProvider from '../../../editors/playgroundSelectionCodeActionProvider';
import ConnectionController from '../../../connectionController';
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import type { LanguageServerController } from '../../../language';
import { PlaygroundController } from '../../../editors';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import TelemetryService from '../../../telemetry/telemetryService';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { ExtensionContextStub, LanguageServerControllerStub } from '../stubs';
import { mockTextEditor } from '../stubs';

const expect = chai.expect;

chai.use(chaiAsPromised);

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
  let testCodeActionProvider: PlaygroundSelectionCodeActionProvider;
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
    testCodeActionProvider = new PlaygroundSelectionCodeActionProvider();
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
      PlaygroundSelectionCodeActionProvider: testCodeActionProvider,
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
        once: sandbox.stub(),
      } as unknown as DataService;

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
      showInformationMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
      sandbox.stub(vscode.window, 'activeTextEditor').get(function getterFn() {
        return undefined;
      });
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
    let showInformationMessageStub: SinonStub;

    beforeEach(() => {
      showInformationMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
      activeTextEditor.document.getText = (): string => '123';
      sandbox.stub(vscode.window, 'activeTextEditor').get(function getterFn() {
        return activeTextEditor;
      });
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
        const expectedMessage =
          'Please connect to a database before running a playground.';
        await testPlaygroundController.runSelectedPlaygroundBlocks();
        expect(showErrorMessageStub.firstCall.args[0]).to.be.equal(
          expectedMessage
        );
      });

      test('run all or selected playground blocks shows please connect to a database error', async () => {
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
              once: sandbox.stub(),
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

      suite('confirmation modal', () => {
        beforeEach(function () {
          sandbox.replace(
            testPlaygroundController,
            '_evaluateWithCancelModal',
            sandbox.stub().resolves({ result: '123' })
          );
          sandbox.replace(
            testPlaygroundController,
            '_openInResultPane',
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
