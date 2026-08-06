import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import PlaygroundSelectionCodeActionProvider from '../../../editors/playgroundSelectionCodeActionProvider';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { PlaygroundController } from '../../../editors';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { ExtensionContextStub } from '../stubs';
import { mockTextEditor } from '../stubs';

suite('Playground Selection Code Action Provider Test Suite', function () {
  this.timeout(5000);

  const extensionContextStub = new ExtensionContextStub();

  const TOTAL_CODEACTIONS_COUNT = 1;

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  suite('the MongoDB playground in JS', function () {
    const testCodeActionProvider = new PlaygroundSelectionCodeActionProvider();
    let sandbox: sinon.SinonSandbox;
    let testActiveTextEditor;

    beforeEach(async function () {
      sandbox = sinon.createSandbox();
      sandbox.stub(vscode.window, 'showInformationMessage');
      sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'trackNewConnection',
      );

      await mdbTestExtension.testExtensionController._connectionController.addNewConnectionStringAndConnect(
        { connectionString: TEST_DATABASE_URI },
      );

      mdbTestExtension.testExtensionController._playgroundController =
        new PlaygroundController({
          connectionController:
            mdbTestExtension.testExtensionController._connectionController,
          languageServerController:
            mdbTestExtension.testExtensionController._languageServerController,
          telemetryService:
            mdbTestExtension.testExtensionController._telemetryService,
          statusView: mdbTestExtension.testExtensionController._statusView,
          playgroundResultProvider:
            mdbTestExtension.testExtensionController._playgroundResultProvider,
          playgroundSelectionCodeActionProvider: testCodeActionProvider,
        });

      const fakeOpenPlaygroundResult = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        '_openInResultPane',
        fakeOpenPlaygroundResult,
      );

      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', false, vscode.ConfigurationTarget.Global);

      await mdbTestExtension.testExtensionController._playgroundController._activeConnectionChanged();

      testActiveTextEditor = sandbox.stub(vscode.window, 'activeTextEditor');
    });

    afterEach(async function () {
      await vscode.commands.executeCommand(
        'workbench.action.closeActiveEditor',
      );
      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', true, vscode.ConfigurationTarget.Global);
      await mdbTestExtension.testExtensionController._connectionController.disconnect();
      mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
      sandbox.restore();
    });

    suite('copilot is disabled', function () {
      beforeEach(function () {
        sandbox.replace(
          vscode.extensions,
          'getExtension',
          sandbox.fake.returns(undefined),
        );
      });

      test('renders only the run selected playground blocks code action', function () {
        const activeTextEditor = mockTextEditor;
        activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
        activeTextEditor.document.getText = (): string => '123';
        activeTextEditor.selections = [
          {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 4 },
          } as vscode.Selection,
        ];
        testActiveTextEditor.get(function getterFn() {
          return activeTextEditor;
        });

        const codeActions = testCodeActionProvider.provideCodeActions();
        expect(codeActions).to.exist;

        if (codeActions) {
          expect(codeActions.length).to.be.equal(1);
          const actionCommand = codeActions[0].command;

          if (actionCommand) {
            expect(actionCommand.command).to.be.equal(
              'mdb.runSelectedPlaygroundBlocks',
            );
            expect(actionCommand.title).to.be.equal(
              'Run selected playground blocks',
            );
          }
        }
      });
    });

    suite('copilot is active', function () {
      beforeEach(function () {
        sandbox.replace(
          vscode.extensions,
          'getExtension',
          sandbox.fake.returns({ isActive: true }),
        );
      });

      test('does not render code actions when text is not selected', function () {
        const activeTextEditor = mockTextEditor;
        activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
        activeTextEditor.document.getText = (): string => '123';
        activeTextEditor.selections = [];
        testActiveTextEditor.get(function getterFn() {
          return activeTextEditor;
        });

        const codeActions = testCodeActionProvider.provideCodeActions();
        expect(codeActions).to.not.exist;
      });

      test('renders the run selected playground blocks code action', function () {
        const activeTextEditor = mockTextEditor;
        activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
        activeTextEditor.document.getText = (): string => '123';
        activeTextEditor.selections = [
          {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 4 },
          } as vscode.Selection,
        ];
        testActiveTextEditor.get(function getterFn() {
          return activeTextEditor;
        });

        const codeActions = testCodeActionProvider.provideCodeActions();
        expect(codeActions).to.exist;

        if (codeActions) {
          expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
          const actionCommand = codeActions[0].command;

          if (actionCommand) {
            expect(actionCommand.command).to.be.equal(
              'mdb.runSelectedPlaygroundBlocks',
            );
            expect(actionCommand.title).to.be.equal(
              'Run selected playground blocks',
            );
          }
        }
      });
    });
  });

  suite('the regular JS file', function () {
    const testCodeActionProvider = new PlaygroundSelectionCodeActionProvider();
    let sandbox: sinon.SinonSandbox;
    let testActiveTextEditor;

    beforeEach(function () {
      sandbox = sinon.createSandbox();
      sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'trackNewConnection',
      );
      testActiveTextEditor = sandbox.stub(vscode.window, 'activeTextEditor');
    });

    afterEach(function () {
      sandbox.restore();
    });

    test('does not render code actions when text is not selected', function () {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.js');
      activeTextEditor.document.getText = (): string => '123';
      activeTextEditor.selections = [];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.be.undefined;
    });

    test('does not render code actions when text is selected', function () {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.js');
      activeTextEditor.document.getText = (): string => '123';
      activeTextEditor.selections = [
        {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 4 },
        } as vscode.Selection,
      ];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.be.undefined;
    });
  });
});
