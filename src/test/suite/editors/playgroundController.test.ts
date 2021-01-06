import * as vscode from 'vscode';
import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext, MockLanguageServerController } from '../stubs';
import { before, beforeEach, afterEach } from 'mocha';
import TelemetryController from '../../../telemetry/telemetryController';

const sinon = require('sinon');
const chai = require('chai');
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
  const mockLanguageServerController = new MockLanguageServerController(
    mockExtensionContext,
    mockStorageController
  );
  const testPlaygroundController = new PlaygroundController(
    mockExtensionContext,
    testConnectionController,
    mockLanguageServerController as LanguageServerController,
    testTelemetryController,
    testStatusView
  );
  const sandbox = sinon.createSandbox();
  let fakeShowInformationMessage: any;
  let fakeShowErrorMessage: any;

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
    const activeTestEditorMock = {
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
        let result: any;

        fakeShowInformationMessage.resolves('Yes');

        try {
          result = await testPlaygroundController.runAllPlaygroundBlocks();
        } catch (error) {
          // No action.
        }

        expect(result).to.be.true;
      });

      test('do not show a confirmation message if mdb.confirmRunAll is false', async () => {
        let result: any;

        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);

        try {
          result = await testPlaygroundController.runAllPlaygroundBlocks();
        } catch (error) {
          // No action.
        }

        expect(result).to.be.true;
      });

      test('do not run a playground if user selected No in the confirmation message', async () => {
        let result: any;

        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', true);

        fakeShowInformationMessage.resolves('No');

        try {
          result = await testPlaygroundController.runAllPlaygroundBlocks();
        } catch (error) {
          // No action.
        }

        expect(result).to.be.false;
      });

      test('close cancelation modal when a playground is canceled', async () => {
        let result: any;

        sinon.replace(
          testPlaygroundController,
          'evaluate',
          sinon.fake.rejects()
        );

        try {
          result = await testPlaygroundController.evaluateWithCancelModal();
        } catch (error) {
          // No action.
        }

        expect(result).to.deep.equal({
          outputLines: undefined,
          result: undefined
        });
      });

      test('do not show code lens if a part of a line is selected', async () => {
        const activeTestEditorWithSelectionMock = {
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

        const codeLens = testPlaygroundController.partialExecutionCodeLensProvider?.provideCodeLenses();

        expect(codeLens?.length).to.be.equal(0);
      });

      test('show code lens if whole line is selected', async () => {
        testPlaygroundController.showCodeLensForSelection(
          new vscode.Range(0, 0, 0, 14)
        );

        const codeLens = testPlaygroundController.partialExecutionCodeLensProvider?.provideCodeLenses();

        expect(codeLens?.length).to.be.equal(1);
      });

      test('playground controller loads the active editor on start', () => {
        sandbox.replaceGetter(
          vscode.window,
          'activeTextEditor',
          () => activeTestEditorMock
        );

        const playgroundControllerTest = new PlaygroundController(
          mockExtensionContext,
          testConnectionController,
          mockLanguageServerController as LanguageServerController,
          testTelemetryController,
          testStatusView
        );

        expect(playgroundControllerTest.activeTextEditor).to.deep.equal(
          activeTestEditorMock
        );
      });

      test('evaluatePlayground should open editor to print results', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const isEditprOpened = await testPlaygroundController.evaluatePlayground();

        expect(isEditprOpened).to.be.equal(true);
      });

      test('getVirtualDocumentUri should return json uri if content is object', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const uri = await testPlaygroundController.getVirtualDocumentUri({
          test: 'value'
        });

        expect(uri.scheme).to.be.equal('PLAYGROUND_RESULT_SCHEME');
        expect(uri.path).to.be.equal('Playground Result.json');
      });

      test('getVirtualDocumentUri should return json uri if content is array', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const uri = await testPlaygroundController.getVirtualDocumentUri([
          { test: 'value' }
        ]);

        expect(uri.scheme).to.be.equal('PLAYGROUND_RESULT_SCHEME');
        expect(uri.path).to.be.equal('Playground Result.json');
      });

      test('getVirtualDocumentUri should return json uri if content is object with BSON value', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const uri = await testPlaygroundController.getVirtualDocumentUri({
          _id: {
            $oid: '5d973ae7443762aae72a160'
          }
        });

        expect(uri.scheme).to.be.equal('PLAYGROUND_RESULT_SCHEME');
        expect(uri.path).to.be.equal('Playground Result.json');
      });

      test('getVirtualDocumentUri should return txt uri if content is string', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const uri = await testPlaygroundController.getVirtualDocumentUri(
          'I am a string'
        );

        expect(uri.scheme).to.be.equal('PLAYGROUND_RESULT_SCHEME');
        expect(uri.path).to.be.equal('Playground Result.txt');
      });

      test('getVirtualDocumentUri should return txt uri if content is number', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const uri = await testPlaygroundController.getVirtualDocumentUri(12);

        expect(uri.scheme).to.be.equal('PLAYGROUND_RESULT_SCHEME');
        expect(uri.path).to.be.equal('Playground Result.txt');
      });
    });
  });
});
