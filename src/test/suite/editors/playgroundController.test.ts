import * as vscode from 'vscode';
import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext, MockLanguageServerController } from '../stubs';
import { before, beforeEach, afterEach } from 'mocha';
import TelemetryService from '../../../telemetry/telemetryService';
import PlaygroundResultProvider from '../../../editors/playgroundResultProvider';
import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import PartialExecutionCodeLensProvider from '../../../editors/partialExecutionCodeLensProvider';

import sinon from 'sinon';
import chai from 'chai';
const expect = chai.expect;

chai.use(require('chai-as-promised'));

const CONNECTION = {
  driverUrlWithSsh: 'mongodb://localhost:27018',
  driverOptions: {}
};

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
  const testPlaygroundResultProvider = new PlaygroundResultProvider(
    mockExtensionContext,
    testConnectionController
  );
  const testActiveDBCodeLensProvider = new ActiveDBCodeLensProvider(
    testConnectionController
  );
  const testPartialExecutionCodeLensProvider = new PartialExecutionCodeLensProvider();
  const testPlaygroundController = new PlaygroundController(
    mockExtensionContext,
    testConnectionController,
    mockLanguageServerController as LanguageServerController,
    testTelemetryService,
    testStatusView,
    testPlaygroundResultProvider,
    testActiveDBCodeLensProvider,
    testPartialExecutionCodeLensProvider
  );
  const sandbox = sinon.createSandbox();
  let fakeShowInformationMessage: sinon.SinonStub;
  let fakeShowErrorMessage: sinon.SinonStub;

  beforeEach(() => {
    fakeShowInformationMessage = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );
    fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  suite('playground is not open', () => {
    testPlaygroundController.activeTextEditor = undefined;

    test('run all playground blocks should throw the playground not found error', async () => {
      const errorMessage =
        "Please open a '.mongodb' playground file before running it.";

      fakeShowErrorMessage.resolves(errorMessage);

      try {
        await testPlaygroundController.runAllPlaygroundBlocks();
      } catch (error) {
        sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
      }
    });

    test('run selected playground blocks should throw the playground not found error', async () => {
      const errorMessage =
        "Please open a '.mongodb' playground file before running it.";

      fakeShowErrorMessage.resolves(errorMessage);

      try {
        await testPlaygroundController.runSelectedPlaygroundBlocks();
      } catch (error) {
        sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
      }
    });

    test('run all or selected playground blocks should throw the playground not found error', async () => {
      const errorMessage =
        "Please open a '.mongodb' playground file before running it.";

      fakeShowErrorMessage.resolves(errorMessage);

      try {
        await testPlaygroundController.runAllOrSelectedPlaygroundBlocks();
      } catch (error) {
        sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
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
      testPlaygroundController.activeTextEditor = activeTestEditorMock as vscode.TextEditor;
    });

    suite('user is not connected', () => {
      before(() => {
        const mockGetActiveConnectionName = sinon.fake.returns('');
        const mockGetActiveConnectionModel = sinon.fake.returns(null);

        sinon.replace(
          testPlaygroundController.connectionController,
          'getActiveConnectionName',
          mockGetActiveConnectionName
        );
        sinon.replace(
          testPlaygroundController.connectionController,
          'getActiveConnectionModel',
          mockGetActiveConnectionModel
        );
      });

      test('run all playground blocks should throw the error', async () => {
        const errorMessage =
          'Please connect to a database before running a playground.';

        fakeShowErrorMessage.resolves(errorMessage);

        try {
          await testPlaygroundController.runAllPlaygroundBlocks();
        } catch (error) {
          sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
        }
      });

      test('run selected playground blocks should throw the error', async () => {
        const errorMessage =
          'Please connect to a database before running a playground.';

        fakeShowErrorMessage.resolves(errorMessage);

        try {
          await testPlaygroundController.runSelectedPlaygroundBlocks();
        } catch (error) {
          sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
        }
      });

      test('run all or selected playground blocks should throw the error', async () => {
        const errorMessage =
          'Please connect to a database before running a playground.';

        fakeShowErrorMessage.resolves(errorMessage);

        try {
          await testPlaygroundController.runAllOrSelectedPlaygroundBlocks();
        } catch (error) {
          sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
        }
      });
    });

    suite('user is connected', () => {
      beforeEach(async () => {
        const mockGetActiveConnectionName = sinon.fake.returns('fakeName');
        const mockGetActiveConnectionModel = sinon.fake.returns({
          appname: 'VSCode Playground Tests',
          port: 27018,
          disconnect: () => {},
          getAttributes: () => CONNECTION
        });

        sinon.replace(
          testPlaygroundController.connectionController,
          'getActiveConnectionName',
          mockGetActiveConnectionName
        );
        sinon.replace(
          testPlaygroundController.connectionController,
          'getActiveConnectionModel',
          mockGetActiveConnectionModel
        );

        await testPlaygroundController.connectToServiceProvider();
      });

      test('show a confirmation message if mdb.confirmRunAll is true', async () => {
        fakeShowInformationMessage.resolves('Yes');

        const mockEvaluateWithCancelModal = sinon.fake.resolves({
          outputLines: [],
          result: '123'
        });
        sinon.replace(
          testPlaygroundController,
          'evaluateWithCancelModal',
          mockEvaluateWithCancelModal
        );

        const mockOpenPlaygroundResult = sinon.fake();
        sinon.replace(
          testPlaygroundController,
          'openPlaygroundResult',
          mockOpenPlaygroundResult
        );

        try {
          const result = await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.equal(true);
          sinon.assert.called(fakeShowInformationMessage);
        } catch (error) {
          expect(error).to.be.equal(undefined);
        }
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
          'evaluateWithCancelModal',
          mockEvaluateWithCancelModal
        );

        const mockOpenPlaygroundResult = sinon.fake();
        sinon.replace(
          testPlaygroundController,
          'openPlaygroundResult',
          mockOpenPlaygroundResult
        );

        try {
          const result = await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.equal(true);
          sinon.assert.notCalled(fakeShowInformationMessage);
        } catch (error) {
          expect(error).to.be.equal(undefined);
        }
      });

      test('do not run a playground if user selected No in the confirmation message', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', true);

        fakeShowInformationMessage.resolves('No');

        try {
          const result = await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.false;
        } catch (error) {
          expect(error).to.be.equal(undefined);
        }
      });

      test('close cancelation modal when a playground is canceled', async () => {
        sinon.replace(
          testPlaygroundController,
          'evaluate',
          sinon.fake.rejects(false)
        );

        try {
          const result = await testPlaygroundController.evaluateWithCancelModal();

          expect(result).to.deep.equal({
            outputLines: undefined,
            result: undefined
          });
        } catch (error) {
          expect(error).to.be.equal(undefined);
        }
      });

      test('do not show code lens if a part of a line is selected', () => {
        const activeTestEditorWithSelectionMock: unknown = {
          document: {
            languageId: 'mongodb',
            uri: {
              path: 'test'
            },
            getText: () => 'dbName',
            lineAt: sinon.fake.returns({ text: "use('dbName');" })
          },
          selections: [
            new vscode.Selection(
              new vscode.Position(0, 5),
              new vscode.Position(0, 11)
            )
          ]
        };

        testPlaygroundController.activeTextEditor = activeTestEditorWithSelectionMock as vscode.TextEditor;

        testPlaygroundController.showCodeLensForSelection(
          new vscode.Range(0, 5, 0, 11)
        );

        const codeLens = testPlaygroundController._partialExecutionCodeLensProvider?.provideCodeLenses();

        expect(codeLens?.length).to.be.equal(0);
      });

      test('show code lens if whole line is selected', () => {
        testPlaygroundController.showCodeLensForSelection(
          new vscode.Range(0, 0, 0, 14)
        );

        const codeLens = testPlaygroundController._partialExecutionCodeLensProvider?.provideCodeLenses();

        expect(codeLens?.length).to.be.equal(1);
      });

      test('playground controller loads the active editor on start', () => {
        sandbox.replaceGetter(
          vscode.window,
          'activeTextEditor',
          () => activeTestEditorMock as vscode.TextEditor
        );

        const playgroundControllerTest = new PlaygroundController(
          mockExtensionContext,
          testConnectionController,
          mockLanguageServerController as LanguageServerController,
          testTelemetryService,
          testStatusView,
          testPlaygroundResultProvider,
          testActiveDBCodeLensProvider,
          testPartialExecutionCodeLensProvider
        );

        expect(playgroundControllerTest.activeTextEditor).to.deep.equal(
          activeTestEditorMock
        );
      });

      test('getDocumentLanguage returns json if content is object', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController.getDocumentLanguage({
          test: 'value'
        });

        expect(language).to.be.equal('json');
      });

      test('getDocumentLanguage returns json if content is array', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController.getDocumentLanguage([
          { test: 'value' }
        ]);

        expect(language).to.be.equal('json');
      });

      test('getDocumentLanguage returns json if content is object with BSON value', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController.getDocumentLanguage({
          _id: {
            $oid: '5d973ae7443762aae72a160'
          }
        });

        expect(language).to.be.equal('json');
      });

      test('getDocumentLanguage returns plaintext if content is string', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController.getDocumentLanguage(
          'I am a string'
        );

        expect(language).to.be.equal('plaintext');
      });

      test('getDocumentLanguage returns plaintext if content is number', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController.getDocumentLanguage(12);

        expect(language).to.be.equal('plaintext');
      });

      test('getDocumentLanguage returns plaintext if content is undefined', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController.getDocumentLanguage(
          undefined
        );

        expect(language).to.be.equal('plaintext');
      });

      test('getDocumentLanguage returns plaintext if content is null', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController.getDocumentLanguage(
          undefined
        );

        expect(language).to.be.equal('plaintext');
      });
    });
  });
});
