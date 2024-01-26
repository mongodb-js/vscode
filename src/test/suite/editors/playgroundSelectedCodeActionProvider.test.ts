import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';

import ActiveConnectionCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';
import PlaygroundSelectedCodeActionProvider from '../../../editors/playgroundSelectedCodeActionProvider';
import { LanguageServerController } from '../../../language';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { PlaygroundController } from '../../../editors';
import type { PlaygroundResult } from '../../../types/playgroundType';
import { ExportToLanguageMode } from '../../../types/playgroundType';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { ExtensionContextStub } from '../stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../../package.json');

const expect = chai.expect;

suite('Playground Selected CodeAction Provider Test Suite', function () {
  this.timeout(5000);

  const extensionContextStub = new ExtensionContextStub();

  const EXPORT_LANGUAGES_CODEACTIONS_COUNT = 8;
  const TOTAL_CODEACTIONS_COUNT = EXPORT_LANGUAGES_CODEACTIONS_COUNT + 1;

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  suite('the MongoDB playground in JS', () => {
    const testCodeActionProvider = new PlaygroundSelectedCodeActionProvider();
    const sandbox = sinon.createSandbox();

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

      const activeConnectionCodeLensProvider =
        new ActiveConnectionCodeLensProvider(
          mdbTestExtension.testExtensionController._connectionController
        );
      const testExportToLanguageCodeLensProvider =
        new ExportToLanguageCodeLensProvider();

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
          activeConnectionCodeLensProvider,
          exportToLanguageCodeLensProvider:
            testExportToLanguageCodeLensProvider,
          playgroundSelectedCodeActionProvider: testCodeActionProvider,
        });

      const fakeOpenPlaygroundResult = sandbox.fake();
      sandbox.replace(
        mdbTestExtension.testExtensionController._playgroundController,
        '_openPlaygroundResult',
        fakeOpenPlaygroundResult
      );

      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', false);

      await mdbTestExtension.testExtensionController._languageServerController.startLanguageServer();
      await mdbTestExtension.testExtensionController._playgroundController._activeConnectionChanged();

      const fakeIsPlayground = sandbox.fake.returns(true);
      sandbox.replace(testCodeActionProvider, 'isPlayground', fakeIsPlayground);
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

    test('returns undefined when text is not selected', () => {
      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.be.undefined;
    });

    test('returns a run selected playground blocks action', async () => {
      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        '123';

      const selection = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 4 },
      } as vscode.Selection;

      testCodeActionProvider.refresh({
        selection,
        mode: ExportToLanguageMode.OTHER,
      });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(1);
        const actionCommand = codeActions[0].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal(
            'mdb.runSelectedPlaygroundBlocks'
          );
          expect(actionCommand.title).to.be.equal(
            'Run selected playground blocks'
          );

          await vscode.commands.executeCommand(actionCommand.command);

          const expectedResult = {
            namespace: null,
            type: 'number',
            content: 123,
            language: 'plaintext',
          };
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._isPartialRun
          ).to.be.equal(true);
        }
      }
    });

    test('returns an export to java action with whitespaces around objects', () => {
      const textFromEditor = ' { name: "Alena Khineika" } ';
      const selection = {
        start: { line: 0, character: 2 },
        end: { line: 0, character: 27 },
      } as vscode.Selection;
      const mode = ExportToLanguageMode.QUERY;
      const activeTextEditor = {
        document: { getText: () => textFromEditor },
      } as vscode.TextEditor;

      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        textFromEditor;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.selection =
        selection;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
        mode;
      mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
        activeTextEditor;

      testCodeActionProvider.refresh({ selection, mode });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[2].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToJava');
          expect(actionCommand.title).to.be.equal('Export To Java');
        }
      }
    });

    suite('exports to java', () => {
      const expectedResult = {
        namespace: 'DATABASE_NAME.COLLECTION_NAME',
        type: null,
        content: 'new Document("name", "22")',
        language: 'java',
      };

      beforeEach(async () => {
        const textFromEditor = "{ name: '22' }";
        const selection = {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 14 },
        } as vscode.Selection;
        const mode = ExportToLanguageMode.QUERY;
        const activeTextEditor = {
          document: { getText: () => textFromEditor },
        } as vscode.TextEditor;

        mdbTestExtension.testExtensionController._playgroundController._selectedText =
          textFromEditor;
        mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.selection =
          selection;
        mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
          mode;
        mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
          activeTextEditor;

        testCodeActionProvider.refresh({ selection, mode });

        // this is to ensure we're starting each test in the same state
        await vscode.commands.executeCommand(
          'mdb.changeExportToLanguageAddons',
          {
            ...mdbTestExtension.testExtensionController._playgroundController
              ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
            builders: false,
            importStatements: false,
            driverSyntax: false,
          }
        );
      });

      test('include builders (only)', async () => {
        const codeActions = testCodeActionProvider.provideCodeActions();
        expect(codeActions).to.exist;

        if (codeActions) {
          expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
          const actionCommand = codeActions[2].command;

          if (actionCommand) {
            expect(actionCommand.command).to.be.equal('mdb.exportToJava');
            expect(actionCommand.title).to.be.equal('Export To Java');

            await vscode.commands.executeCommand(actionCommand.command);

            const codeLenses =
              mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
            expect(codeLenses.length).to.be.equal(3);
            const lensesObj = { lenses: codeLenses };
            expect(lensesObj).to.have.nested.property(
              'lenses[0].command.title',
              'Include Import Statements'
            );
            expect(lensesObj).to.have.nested.property(
              'lenses[1].command.title',
              'Include Driver Syntax'
            );
            expect(lensesObj).to.have.nested.property(
              'lenses[2].command.title',
              'Use Builders'
            );
          }

          // Only java queries supports builders.
          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              builders: true,
              importStatements: false,
              driverSyntax: false,
            }
          );

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Include Import Statements'
          );
          expect(lensesObj).to.have.nested.property(
            'lenses[1].command.title',
            'Include Driver Syntax'
          );
          expect(lensesObj).to.have.nested.property(
            'lenses[2].command.title',
            'Use Raw Query'
          );

          expectedResult.content = 'eq("name", "22")';
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);
        }
      });

      test('include driver syntax (only)', async () => {
        const codeActions = testCodeActionProvider.provideCodeActions();
        expect(codeActions).to.exist;

        if (codeActions) {
          expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
          const actionCommand = codeActions[2].command;

          if (actionCommand) {
            expect(actionCommand.command).to.be.equal('mdb.exportToJava');
            expect(actionCommand.title).to.be.equal('Export To Java');

            await vscode.commands.executeCommand(actionCommand.command);

            const codeLenses =
              mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
            expect(codeLenses.length).to.be.equal(3);
            const lensesObj = { lenses: codeLenses };
            expect(lensesObj).to.have.nested.property(
              'lenses[0].command.title',
              'Include Import Statements'
            );
            expect(lensesObj).to.have.nested.property(
              'lenses[1].command.title',
              'Include Driver Syntax'
            );
            expect(lensesObj).to.have.nested.property(
              'lenses[2].command.title',
              'Use Builders'
            );
          }

          // Only java queries supports builders.
          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              builders: false,
              importStatements: false,
              driverSyntax: true,
            }
          );

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Include Import Statements'
          );
          expect(lensesObj).to.have.nested.property(
            'lenses[1].command.title',
            'Exclude Driver Syntax'
          );
          expect(lensesObj).to.have.nested.property(
            'lenses[2].command.title',
            'Use Builders'
          );

          const driverSyntaxRawQuery =
            'Bson filter = new Document("name", "22");';
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult?.content
          ).to.include(driverSyntaxRawQuery);
        }
      });

      test('include import statements (only)', async () => {
        const codeActions = testCodeActionProvider.provideCodeActions();
        expect(codeActions).to.exist;

        if (codeActions) {
          expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
          const actionCommand = codeActions[2].command;

          if (actionCommand) {
            expect(actionCommand.command).to.be.equal('mdb.exportToJava');
            expect(actionCommand.title).to.be.equal('Export To Java');

            await vscode.commands.executeCommand(actionCommand.command);

            const codeLenses =
              mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
            expect(codeLenses.length).to.be.equal(3);
            const lensesObj = { lenses: codeLenses };
            expect(lensesObj).to.have.nested.property(
              'lenses[0].command.title',
              'Include Import Statements'
            );
            expect(lensesObj).to.have.nested.property(
              'lenses[1].command.title',
              'Include Driver Syntax'
            );
            expect(lensesObj).to.have.nested.property(
              'lenses[2].command.title',
              'Use Builders'
            );
          }

          // Only java queries supports builders.
          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              builders: false,
              importStatements: true,
              driverSyntax: false,
            }
          );

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Exclude Import Statements'
          );
          expect(lensesObj).to.have.nested.property(
            'lenses[1].command.title',
            'Include Driver Syntax'
          );
          expect(lensesObj).to.have.nested.property(
            'lenses[2].command.title',
            'Use Builders'
          );

          const rawQueryWithImport =
            'import org.bson.Document;\n\nnew Document("name", "22")';
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult?.content
          ).to.deep.equal(rawQueryWithImport);
        }
      });

      test('include driver syntax and import statements', async () => {
        const codeActions = testCodeActionProvider.provideCodeActions();
        expect(codeActions).to.exist;

        if (codeActions) {
          expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
          const actionCommand = codeActions[2].command;

          if (actionCommand) {
            expect(actionCommand.command).to.be.equal('mdb.exportToJava');
            expect(actionCommand.title).to.be.equal('Export To Java');

            await vscode.commands.executeCommand(actionCommand.command);

            const codeLenses =
              mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
            expect(codeLenses.length).to.be.equal(3);
            const lensesObj = { lenses: codeLenses };
            expect(lensesObj).to.have.nested.property(
              'lenses[0].command.title',
              'Include Import Statements'
            );
            expect(lensesObj).to.have.nested.property(
              'lenses[1].command.title',
              'Include Driver Syntax'
            );
            expect(lensesObj).to.have.nested.property(
              'lenses[2].command.title',
              'Use Builders'
            );
          }

          // Only java queries supports builders.
          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              builders: false,
              importStatements: true,
              driverSyntax: true,
            }
          );

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          const lensesObj = { lenses: codeLenses };
          expect(lensesObj).to.have.nested.property(
            'lenses[0].command.title',
            'Exclude Import Statements'
          );
          expect(lensesObj).to.have.nested.property(
            'lenses[1].command.title',
            'Exclude Driver Syntax'
          );
          expect(lensesObj).to.have.nested.property(
            'lenses[2].command.title',
            'Use Builders'
          );

          // Java includes generic import statements
          const mongoClientImport = 'import com.mongodb.MongoClient;';
          // but also import statements which depend on the exportToLanguageMode. the following is for QUERY
          const queryImport = 'import com.mongodb.client.FindIterable;';
          const content =
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult?.content;
          expect(content).to.include(mongoClientImport);
          expect(content).to.include(queryImport);
        }
      });
    });

    test('exports to csharp and includes import statements', async () => {
      const textFromEditor = "{ name: '22' }";
      const selection = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 14 },
      } as vscode.Selection;
      const mode = ExportToLanguageMode.QUERY;
      const activeTextEditor = {
        document: { getText: () => textFromEditor },
      } as vscode.TextEditor;

      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        textFromEditor;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.selection =
        selection;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
        mode;
      mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
        activeTextEditor;

      testCodeActionProvider.refresh({ selection, mode });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[3].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToCsharp');
          expect(actionCommand.title).to.be.equal('Export To C#');

          await vscode.commands.executeCommand(actionCommand.command);

          const expectedResult = {
            namespace: 'DATABASE_NAME.COLLECTION_NAME',
            type: null,
            content: 'new BsonDocument("name", "22")',
            language: 'csharp',
          };
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(1); // Csharp does not support driver syntax.

          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              importStatements: true,
            }
          );

          expectedResult.content =
            'using MongoDB.Bson;\nusing MongoDB.Driver;\n\nnew BsonDocument("name", "22")';
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);
        }
      }
    });

    test('exports to python and includes driver syntax', async () => {
      const textFromEditor = "use('db'); db.coll.find({ name: '22' })";
      const selection = {
        start: { line: 0, character: 24 },
        end: { line: 0, character: 38 },
      } as vscode.Selection;
      const mode = ExportToLanguageMode.QUERY;
      const activeTextEditor = {
        document: { getText: () => textFromEditor },
      } as vscode.TextEditor;

      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        "{ name: '22' }";
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.selection =
        selection;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
        mode;
      mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
        activeTextEditor;

      testCodeActionProvider.refresh({ selection, mode });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[1].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToPython');
          expect(actionCommand.title).to.be.equal('Export To Python 3');

          await vscode.commands.executeCommand(actionCommand.command);

          let expectedResult: PlaygroundResult = {
            namespace: 'DATABASE_NAME.COLLECTION_NAME',
            type: null,
            content: "{\n    'name': '22'\n}",
            language: 'python',
          };
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(2);

          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              driverSyntax: true,
            }
          );

          expectedResult = {
            namespace: 'db.coll',
            type: null,
            content: `# Requires the PyMongo package.\n# https://api.mongodb.com/python/current\n\nclient = MongoClient('mongodb://localhost:27088/?appname=mongodb-vscode+${version}')\nfilter={\n    'name': '22'\n}\n\nresult = client['db']['coll'].find(\n  filter=filter\n)`,
            language: 'python',
          };

          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);
        }
      }
    });

    test('exports to ruby and includes driver syntax', async () => {
      const textFromEditor = "use('db'); db.coll.find({ name: '22' })";
      const selection = {
        start: { line: 0, character: 24 },
        end: { line: 0, character: 38 },
      } as vscode.Selection;
      const mode = ExportToLanguageMode.QUERY;
      const activeTextEditor = {
        document: { getText: () => textFromEditor },
      } as vscode.TextEditor;

      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        "{ name: '22' }";
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.selection =
        selection;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
        mode;
      mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
        activeTextEditor;

      testCodeActionProvider.refresh({ selection, mode });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[5].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToRuby');
          expect(actionCommand.title).to.be.equal('Export To Ruby');

          await vscode.commands.executeCommand(actionCommand.command);

          let expectedResult: PlaygroundResult = {
            namespace: 'DATABASE_NAME.COLLECTION_NAME',
            type: null,
            content: "{\n  'name' => '22'\n}",
            language: 'ruby',
          };
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(2);

          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              driverSyntax: true,
            }
          );

          expectedResult = {
            namespace: 'db.coll',
            type: null,
            content: `# Requires the MongoDB Ruby Driver\n# https://docs.mongodb.com/ruby-driver/master/\n\nclient = Mongo::Client.new('mongodb://localhost:27088/?appname=mongodb-vscode+${version}', :database => 'db')\n\nresult = client.database['coll'].find({\n  'name' => '22'\n})`,
            language: 'ruby',
          };

          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);
        }
      }
    });

    test('exports to go and includes driver syntax', async () => {
      const textFromEditor = "use('db'); db.coll.find({ name: '22' })";
      const selection = {
        start: { line: 0, character: 24 },
        end: { line: 0, character: 38 },
      } as vscode.Selection;
      const mode = ExportToLanguageMode.QUERY;
      const activeTextEditor = {
        document: { getText: () => textFromEditor },
      } as vscode.TextEditor;

      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        "{ name: '22' }";
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.selection =
        selection;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
        mode;
      mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
        activeTextEditor;

      testCodeActionProvider.refresh({ selection, mode });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[6].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToGo');
          expect(actionCommand.title).to.be.equal('Export To Go');

          await vscode.commands.executeCommand(actionCommand.command);

          let expectedResult: PlaygroundResult = {
            namespace: 'DATABASE_NAME.COLLECTION_NAME',
            type: null,
            content: 'bson.D{{"name", "22"}}',
            language: 'go',
          };
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(2);

          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              driverSyntax: true,
            }
          );

          expectedResult = {
            namespace: 'db.coll',
            type: null,
            content: `// Requires the MongoDB Go Driver\n// https://go.mongodb.org/mongo-driver\nctx := context.TODO()\n\n// Set client options\nclientOptions := options.Client().ApplyURI(\"mongodb://localhost:27088/?appname=mongodb-vscode+${version}\")\n\n// Connect to MongoDB\nclient, err := mongo.Connect(ctx, clientOptions)\nif err != nil {\n  log.Fatal(err)\n}\ndefer func() {\n  if err := client.Disconnect(ctx); err != nil {\n    log.Fatal(err)\n  }\n}()\n\ncoll := client.Database(\"db\").Collection(\"coll\")\n_, err = coll.Find(ctx, bson.D{{\"name\", \"22\"}})\nif err != nil {\n  log.Fatal(err)\n}`,
            language: 'go',
          };

          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);
        }
      }
    });

    test('exports to rust and includes driver syntax', async () => {
      const textFromEditor = "use('db'); db.coll.find({ name: '22' })";
      const selection = {
        start: { line: 0, character: 24 },
        end: { line: 0, character: 38 },
      } as vscode.Selection;
      const mode = ExportToLanguageMode.QUERY;
      const activeTextEditor = {
        document: { getText: () => textFromEditor },
      } as vscode.TextEditor;

      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        "{ name: '22' }";
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.selection =
        selection;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
        mode;
      mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
        activeTextEditor;

      testCodeActionProvider.refresh({ selection, mode });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[7].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToRust');
          expect(actionCommand.title).to.be.equal('Export To Rust');

          await vscode.commands.executeCommand(actionCommand.command);

          let expectedResult: PlaygroundResult = {
            namespace: 'DATABASE_NAME.COLLECTION_NAME',
            type: null,
            content: 'doc! {\n    "name": "22"\n}',
            language: 'rust',
          };
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(2);

          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              driverSyntax: true,
            }
          );

          expectedResult = {
            namespace: 'db.coll',
            type: null,
            content: `// Requires the MongoDB crate.\n// https://crates.io/crates/mongodb\n\nlet client = Client::with_uri_str(\"mongodb://localhost:27088/?appname=mongodb-vscode+${version}\").await?;\nlet result = client.database(\"db\").collection::<Document>(\"coll\").find(doc! {\n    \"name\": \"22\"\n}, None).await?;`,
            language: 'rust',
          };

          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);
        }
      }
    });

    test('exports to php and includes driver syntax', async () => {
      const textFromEditor = "use('db'); db.coll.find({ name: '22' })";
      const selection = {
        start: { line: 0, character: 24 },
        end: { line: 0, character: 38 },
      } as vscode.Selection;
      const mode = ExportToLanguageMode.QUERY;
      const activeTextEditor = {
        document: { getText: () => textFromEditor },
      } as vscode.TextEditor;

      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        "{ name: '22' }";
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.selection =
        selection;
      mdbTestExtension.testExtensionController._playgroundController._playgroundSelectedCodeActionProvider.mode =
        mode;
      mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
        activeTextEditor;

      testCodeActionProvider.refresh({ selection, mode });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.exist;

      if (codeActions) {
        expect(codeActions.length).to.be.equal(TOTAL_CODEACTIONS_COUNT);
        const actionCommand = codeActions[8].command;

        if (actionCommand) {
          expect(actionCommand.command).to.be.equal('mdb.exportToPHP');
          expect(actionCommand.title).to.be.equal('Export To PHP');

          await vscode.commands.executeCommand(actionCommand.command);

          let expectedResult: PlaygroundResult = {
            namespace: 'DATABASE_NAME.COLLECTION_NAME',
            type: null,
            content: "['name' => '22']",
            language: 'php',
          };
          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);

          const codeLenses =
            mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
          expect(codeLenses.length).to.be.equal(2);

          await vscode.commands.executeCommand(
            'mdb.changeExportToLanguageAddons',
            {
              ...mdbTestExtension.testExtensionController._playgroundController
                ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
              driverSyntax: true,
            }
          );

          expectedResult = {
            namespace: 'db.coll',
            type: null,
            content: `// Requires the MongoDB PHP Driver\n// https://www.mongodb.com/docs/drivers/php/\n\n$client = new Client('mongodb://localhost:27088/?appname=mongodb-vscode+${version}');\n$collection = $client->selectCollection('db', 'coll');\n$cursor = $collection->find(['name' => '22']);`,
            language: 'php',
          };

          expect(
            mdbTestExtension.testExtensionController._playgroundController
              ._playgroundResult
          ).to.be.deep.equal(expectedResult);
        }
      }
    });
  });

  suite('the regular JS file', () => {
    const testCodeActionProvider = new PlaygroundSelectedCodeActionProvider();
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
      const fakeIsPlayground = sandbox.fake.returns(false);
      sandbox.replace(testCodeActionProvider, 'isPlayground', fakeIsPlayground);
      sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'trackNewConnection'
      );
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('returns undefined when text is not selected', () => {
      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.be.undefined;
    });

    test('returns undefined when text is selected', () => {
      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        '123';

      const selection = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 4 },
      } as vscode.Selection;

      testCodeActionProvider.refresh({
        selection,
        mode: ExportToLanguageMode.OTHER,
      });

      const codeActions = testCodeActionProvider.provideCodeActions();
      expect(codeActions).to.be.undefined;
    });
  });
});
