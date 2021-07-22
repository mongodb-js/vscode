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
import EditDocumentCodeLensProvider from '../../../editors/editDocumentCodeLensProvider';
import { ExplorerController } from '../../../explorer';

import sinon from 'sinon';
import chai from 'chai';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { ConnectionModel } from '../../../types/connectionModelType';
const expect = chai.expect;

chai.use(require('chai-as-promised'));

const CONNECTION = {
  driverUrlWithSsh: 'mongodb://localhost:27018',
  driverOptions: {}
};

const mockPlayground = 'use(\'dbName\');\n    a\n\n\n\ndb.find();';

const activeTestEditorWithSelectionMock = {
  document: {
    languageId: 'mongodb',
    uri: {
      path: 'test'
    } as vscode.Uri,
    getText: (range: vscode.Range) => mockPlayground.split('\n')[range.start.line].substr(range.start.character, range.end.character),
    lineAt: (lineNumber: number) => ({
      text: mockPlayground.split('\n')[lineNumber]
    }),
    lineCount: mockPlayground.split('\n').length
  },
  selections: [
    new vscode.Selection(
      new vscode.Position(0, 5),
      new vscode.Position(0, 11)
    )
  ],
  edit: () => null
} as unknown as vscode.TextEditor;


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
  const testPartialExecutionCodeLensProvider = new PartialExecutionCodeLensProvider();
  const testExplorerController = new ExplorerController(
    testConnectionController
  );
  const testPlaygroundController = new PlaygroundController(
    mockExtensionContext,
    testConnectionController,
    mockLanguageServerController as LanguageServerController,
    testTelemetryService,
    testStatusView,
    testPlaygroundResultProvider,
    testActiveDBCodeLensProvider,
    testPartialExecutionCodeLensProvider,
    testExplorerController
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

  suite('passing connection details to service provider', () => {
    let mockConnectToServiceProvider: sinon.SinonSpy;

    beforeEach(async () => {
      const mockGetActiveConnectionName = sinon.fake.returns('fakeName');
      const mockGetActiveDataService = sinon.fake.returns({
        getConnectionOptions: () => ({
          url: TEST_DATABASE_URI,
          options: {
            appname: 'VSCode Playground Tests',
            port: 27018,
            sslKey: 'some buffer',
            sslCert: 'not the file path',
            sslCA: 'aaaa',
          }
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
      sinon.replace(
        testPlaygroundController._connectionController,
        'getActiveConnectionModel',
        () => (({
          getAttributes: () => ({
            driverOptions: {
              sslKey: 'sslKeyFile.pem',
              sslCert: 'sslCertFile.pem',
              sslCA: 'sslCAFile.pem'
            }
          })
        } as any)as ConnectionModel)
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
          connectionOptions: {
            sslKey: string;
          }
        }).connectionOptions.sslKey
      ).to.equal('sslKeyFile.pem');
      expect(
        (mockConnectToServiceProvider.firstCall.firstArg as {
          connectionOptions: {
            sslCert: string;
          }
        }).connectionOptions.sslCert
      ).to.equal('sslCertFile.pem');
      expect(
        (mockConnectToServiceProvider.firstCall.firstArg as {
          connectionOptions: {
            sslCA: string;
          }
        }).connectionOptions.sslCA
      ).to.equal('sslCAFile.pem');
    });
  });

  suite('playground is not open', () => {
    testPlaygroundController._activeTextEditor = undefined;

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
      testPlaygroundController._activeTextEditor = activeTestEditorMock as vscode.TextEditor;
    });

    suite('user is not connected', () => {
      before(() => {
        const mockGetActiveConnectionName = sinon.fake.returns('');
        const mockGetActiveConnectionModel = sinon.fake.returns(null);

        sinon.replace(
          testPlaygroundController._connectionController,
          'getActiveConnectionName',
          mockGetActiveConnectionName
        );
        sinon.replace(
          testPlaygroundController._connectionController,
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
        const mockGetActiveDataService = sinon.fake.returns({
          getConnectionOptions: () => ({
            url: TEST_DATABASE_URI,
            options: {
              appname: 'VSCode Playground Tests',
              port: 27018,
              disconnect: () => {},
              getAttributes: () => CONNECTION
            }
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

      test('do not show code lens if a part of a line with content is selected', () => {
        testPlaygroundController._selectedText = 'db';
        testPlaygroundController._activeTextEditor = activeTestEditorWithSelectionMock;

        testPlaygroundController._showCodeLensForSelection(
          [new vscode.Selection(
            new vscode.Position(0, 5),
            new vscode.Position(0, 11)
          )],
          activeTestEditorWithSelectionMock
        );

        const codeLens = testPlaygroundController._partialExecutionCodeLensProvider?.provideCodeLenses();

        expect(codeLens.length).to.be.equal(0);
      });

      test('do not show code lens when it has no content (multi-line)', () => {
        testPlaygroundController._selectedText = '   \n\n ';
        testPlaygroundController._activeTextEditor = activeTestEditorWithSelectionMock;

        testPlaygroundController._showCodeLensForSelection(
          [new vscode.Selection(
            new vscode.Position(2, 0),
            new vscode.Position(4, 0)
          )],
          activeTestEditorWithSelectionMock
        );

        const codeLens = testPlaygroundController._partialExecutionCodeLensProvider?.provideCodeLenses();

        expect(codeLens.length).to.be.equal(0);
      });

      test('show code lens if whole line is selected', () => {
        testPlaygroundController._selectedText = 'use(\'dbName\');';
        testPlaygroundController._showCodeLensForSelection(
          [new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(0, 15)
          )],
          activeTestEditorWithSelectionMock
        );

        const codeLens = testPlaygroundController._partialExecutionCodeLensProvider.provideCodeLenses();

        expect(codeLens.length).to.be.equal(1);
        expect(codeLens[0].range.end.line).to.be.equal(1);
      });

      test('has the correct line number for code lens when the selection includes the last line', () => {
        testPlaygroundController._selectedText = 'use(\'dbName\');\n\na';
        const fakeEdit = sinon.fake.returns(() => ({ insert: sinon.fake() }));
        sandbox.replace(
          activeTestEditorWithSelectionMock,
          'edit',
          fakeEdit
        );
        testPlaygroundController._showCodeLensForSelection(
          [new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(5, 5)
          )],
          activeTestEditorWithSelectionMock
        );

        const codeLens = testPlaygroundController._partialExecutionCodeLensProvider.provideCodeLenses();

        expect(codeLens.length).to.be.equal(1);
        expect(codeLens[0].range.start.line).to.be.equal(6);
        expect(codeLens[0].range.end.line).to.be.equal(6);
        expect(fakeEdit).to.be.called;
      });

      test('it calls to edit the document to add an empty line if the selection includes the last line with content', (done) => {
        testPlaygroundController._selectedText = 'use(\'dbName\');\n\na';
        sandbox.replace(
          activeTestEditorWithSelectionMock,
          'edit',
          (cb) => {
            cb({
              insert: (position: vscode.Position, toInsert: string) => {
                expect(position.line).to.equal(6);
                expect(toInsert).to.equal('\n');
                done();
              }
            } as unknown as vscode.TextEditorEdit);
            return new Promise((resolve) => resolve(true));
          }
        );
        testPlaygroundController._showCodeLensForSelection(
          [new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(5, 5)
          )],
          activeTestEditorWithSelectionMock
        );
      });

      test('shows the codelens on the line above the last selected line when the last selected line is empty', () => {
        testPlaygroundController._selectedText = 'use(\'dbName\');\n\n';
        testPlaygroundController._showCodeLensForSelection(
          [new vscode.Selection(
            new vscode.Position(0, 0),
            new vscode.Position(1, 3)
          )],
          activeTestEditorWithSelectionMock
        );

        const codeLens = testPlaygroundController._partialExecutionCodeLensProvider.provideCodeLenses();

        expect(codeLens.length).to.be.equal(1);
        expect(codeLens[0].range.start.line).to.be.equal(2);
        expect(codeLens[0].range.end.line).to.be.equal(2);
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
          mockExtensionContext,
          testConnectionController,
          mockLanguageServerController as LanguageServerController,
          testTelemetryService,
          testStatusView,
          testPlaygroundResultProvider,
          testActiveDBCodeLensProvider,
          testPartialExecutionCodeLensProvider,
          testExplorerController
        );

        expect(playgroundControllerTest._activeTextEditor).to.deep.equal(
          activeTestEditorMock
        );
      });

      test('getDocumentLanguage returns json if content is object', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController._getDocumentLanguage({
          test: 'value'
        });

        expect(language).to.be.equal('json');
      });

      test('getDocumentLanguage returns json if content is array', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController._getDocumentLanguage([
          { test: 'value' }
        ]);

        expect(language).to.be.equal('json');
      });

      test('getDocumentLanguage returns json if content is object with BSON value', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController._getDocumentLanguage({
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
        const language = testPlaygroundController._getDocumentLanguage(
          'I am a string'
        );

        expect(language).to.be.equal('plaintext');
      });

      test('getDocumentLanguage returns plaintext if content is number', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController._getDocumentLanguage(12);

        expect(language).to.be.equal('plaintext');
      });

      test('getDocumentLanguage returns plaintext if content is undefined', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController._getDocumentLanguage(
          undefined
        );

        expect(language).to.be.equal('plaintext');
      });

      test('getDocumentLanguage returns plaintext if content is null', async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('confirmRunAll', false);
        const language = testPlaygroundController._getDocumentLanguage(
          undefined
        );

        expect(language).to.be.equal('plaintext');
      });
    });
  });
});
