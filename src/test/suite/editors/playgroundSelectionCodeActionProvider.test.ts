import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';
import PlaygroundSelectionCodeActionProvider from '../../../editors/playgroundSelectionCodeActionProvider';
import { LanguageServerController } from '../../../language';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { PlaygroundController } from '../../../editors';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { ExtensionContextStub } from '../stubs';
import { mockTextEditor } from '../stubs';

const expect = chai.expect;

suite('Playground Selection Code Action Provider Test Suite', function () {
  this.timeout(5000);

  const extensionContextStub = new ExtensionContextStub();

  const EXPORT_LANGUAGES_CODEACTIONS_COUNT = 8;
  const TOTAL_CODEACTIONS_COUNT = EXPORT_LANGUAGES_CODEACTIONS_COUNT + 1;

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  suite('the MongoDB playground in JS', () => {
    const testCodeActionProvider = new PlaygroundSelectionCodeActionProvider();
    const sandbox = sinon.createSandbox();
    let testActiveTextEditor;

    beforeEach(async () => {
      sandbox.replace(
        mdbTestExtension.testExtensionController,
        '_languageServerController',
        new LanguageServerController(extensionContextStub)
      );
      sandbox.stub(vscode.window, 'showInformationMessage');
      sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'trackNewConnection'
      );

      await mdbTestExtension.testExtensionController._connectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
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
          playgroundResultViewProvider:
            mdbTestExtension.testExtensionController
              ._playgroundResultViewProvider,
          playgroundSelectionCodeActionProvider: testCodeActionProvider,
        });

      const fakeOpenPlaygroundResult = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        '_openInResultPane',
        fakeOpenPlaygroundResult
      );

      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', false);

      await mdbTestExtension.testExtensionController._languageServerController.startLanguageServer();
      await mdbTestExtension.testExtensionController._playgroundController._activeConnectionChanged();

      testActiveTextEditor = sandbox.stub(vscode.window, 'activeTextEditor');
    });

    afterEach(async () => {
      await vscode.commands.executeCommand(
        'workbench.action.closeActiveEditor'
      );
      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', true);
      await mdbTestExtension.testExtensionController._connectionController.disconnect();
      mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
      sandbox.restore();
    });

    test('does not render code actions when text is not selected', () => {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
      activeTextEditor.document.getText = (): string => '123';
      activeTextEditor.selections = [];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.not.exist;
    });

    test('renders the run selected playground blocks code action', () => {
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
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[0].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal(
            'mdb.runSelectedPlaygroundBlocks'
          );
          expect(actionCommand.title).to.be.equal(
            'Run selected playground blocks'
          );
        }
      }
    });

    suite('renders export to java code actions', () => {
      beforeEach(async () => {
        const activeTextEditor = mockTextEditor;
        activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
        activeTextEditor.document.getText = (): string => "{ name: '22' }";
        activeTextEditor.selections = [
          {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 14 },
          } as vscode.Selection,
        ];
        testActiveTextEditor.get(function getterFn() {
          return activeTextEditor;
        });
        testCodeActionProvider.refresh();

        // this is to ensure we're starting each test in the same state
        await vscode.commands.executeCommand(
          'mdb.changeExportToLanguageAddons',
          {
            ...mdbTestExtension.testExtensionController._participantController
              ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
            importStatements: false,
            driverSyntax: false,
          }
        );
      });

      test('renders the include driver syntax code action and changes it to exclude', async () => {
        const codeActions = testCodeActionProvider.provideCodeActions();

        if (!codeActions) {
          expect.fail('No code actions');
          return false;
        }

        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[2].command;

        if (!actionCommand) {
          expect.fail('Action command not found');
          return false;
        }

        expect(actionCommand.command).to.be.equal('mdb.exportToJava');
        expect(actionCommand.title).to.be.equal('Export To Java');

        await vscode.commands.executeCommand(actionCommand.command);

        let codeLenses =
          mdbTestExtension.testExtensionController._participantController._exportToLanguageCodeLensProvider.provideCodeLenses();
        expect(codeLenses.length).to.be.equal(1);
        let lensesObj = { lenses: codeLenses };
        expect(lensesObj).to.have.nested.property(
          'lenses[0].command.title',
          'Include Driver Syntax'
        );

        await vscode.commands.executeCommand(
          'mdb.changeExportToLanguageAddons',
          {
            ...mdbTestExtension.testExtensionController._participantController
              ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
            driverSyntax: true,
          }
        );

        codeLenses =
          mdbTestExtension.testExtensionController._participantController._exportToLanguageCodeLensProvider.provideCodeLenses();
        lensesObj = { lenses: codeLenses };
        expect(lensesObj).to.have.nested.property(
          'lenses[0].command.title',
          'Exclude Driver Syntax'
        );
      });
    });

    test('renders export to csharp code actions', async () => {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
      activeTextEditor.document.getText = (): string => "{ name: '22' }";
      activeTextEditor.selections = [
        {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 14 },
        } as vscode.Selection,
      ];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[3].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToCsharp');
          expect(actionCommand.title).to.be.equal('Export To C#');

          await vscode.commands.executeCommand(actionCommand.command);

          const codeLenses =
            mdbTestExtension.testExtensionController._participantController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(0); // Csharp does not support driver syntax.
        }
      }
    });

    test('renders export to python code actions', async () => {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
      activeTextEditor.document.getText = (): string =>
        "use('db'); db.coll.find({ name: '22' })";
      activeTextEditor.selections = [
        {
          start: { line: 0, character: 24 },
          end: { line: 0, character: 38 },
        } as vscode.Selection,
      ];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[1].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToPython');
          expect(actionCommand.title).to.be.equal('Export To Python 3');

          await vscode.commands.executeCommand(actionCommand.command);

          const codeLenses =
            mdbTestExtension.testExtensionController._participantController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(1);
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Include Driver Syntax'
          );
        }
      }
    });

    test('renders export to ruby code actions', async () => {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
      activeTextEditor.document.getText = (): string =>
        "use('db'); db.coll.find({ name: '22' })";
      activeTextEditor.selections = [
        {
          start: { line: 0, character: 24 },
          end: { line: 0, character: 38 },
        } as vscode.Selection,
      ];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[5].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToRuby');
          expect(actionCommand.title).to.be.equal('Export To Ruby');

          await vscode.commands.executeCommand(actionCommand.command);

          const codeLenses =
            mdbTestExtension.testExtensionController._participantController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(1);
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Include Driver Syntax'
          );
        }
      }
    });

    test('renders export to go code actions', async () => {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
      activeTextEditor.document.getText = (): string =>
        "use('db'); db.coll.find({ name: '22' })";
      activeTextEditor.selections = [
        {
          start: { line: 0, character: 24 },
          end: { line: 0, character: 38 },
        } as vscode.Selection,
      ];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[6].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToGo');
          expect(actionCommand.title).to.be.equal('Export To Go');

          await vscode.commands.executeCommand(actionCommand.command);

          const codeLenses =
            mdbTestExtension.testExtensionController._participantController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(1);
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Include Driver Syntax'
          );
        }
      }
    });

    test('renders export to rust code actions', async () => {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
      activeTextEditor.document.getText = (): string =>
        "use('db'); db.coll.find({ name: '22' })";
      activeTextEditor.selections = [
        {
          start: { line: 0, character: 24 },
          end: { line: 0, character: 38 },
        } as vscode.Selection,
      ];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[7].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToRust');
          expect(actionCommand.title).to.be.equal('Export To Rust');

          await vscode.commands.executeCommand(actionCommand.command);

          const codeLenses =
            mdbTestExtension.testExtensionController._participantController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(1);
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Include Driver Syntax'
          );
        }
      }
    });

    test('renders export to php code actions', async () => {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.mongodb.js');
      activeTextEditor.document.getText = (): string =>
        "use('db'); db.coll.find({ name: '22' })";
      activeTextEditor.selections = [
        {
          start: { line: 0, character: 24 },
          end: { line: 0, character: 38 },
        } as vscode.Selection,
      ];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[8].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToPHP');
          expect(actionCommand.title).to.be.equal('Export To PHP');

          await vscode.commands.executeCommand(actionCommand.command);

          const codeLenses =
            mdbTestExtension.testExtensionController._participantController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(1);
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Include Driver Syntax'
          );
        }
      }
    });
  });

  suite('the regular JS file', () => {
    const testCodeActionProvider = new PlaygroundSelectionCodeActionProvider();
    const sandbox = sinon.createSandbox();
    let testActiveTextEditor;

    beforeEach(() => {
      sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'trackNewConnection'
      );
      testActiveTextEditor = sandbox.stub(vscode.window, 'activeTextEditor');
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('does not render code actions when text is not selected', () => {
      const activeTextEditor = mockTextEditor;
      activeTextEditor.document.uri = vscode.Uri.parse('test.js');
      activeTextEditor.document.getText = (): string => '123';
      activeTextEditor.selections = [];
      testActiveTextEditor.get(function getterFn() {
        return activeTextEditor;
      });
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.be.undefined;
    });

    test('does not render code actions when text is selected', () => {
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
      testCodeActionProvider.refresh();

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.be.undefined;
    });
  });
});
