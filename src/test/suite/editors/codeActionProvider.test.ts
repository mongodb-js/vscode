import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';

import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import ExportToLanguageCodeLensProvider from '../../../editors/exportToLanguageCodeLensProvider';
import CodeActionProvider from '../../../editors/codeActionProvider';
import { ExplorerController } from '../../../explorer';
import { LanguageServerController } from '../../../language';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { PlaygroundController } from '../../../editors';
import {
  PlaygroundResult,
  ExportToLanguageMode,
} from '../../../types/playgroundType';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { TestExtensionContext } from '../stubs';

const expect = chai.expect;

suite('Code Action Provider Test Suite', function () {
  this.timeout(5000);

  const testExtensionContext = new TestExtensionContext();
  testExtensionContext.extensionPath = '../../';

  beforeEach(async () => {
    sinon.replace(
      mdbTestExtension.testExtensionController,
      '_languageServerController',
      new LanguageServerController(testExtensionContext)
    );
    sinon.replace(
      vscode.window,
      'showInformationMessage',
      sinon.fake.resolves(true)
    );

    await mdbTestExtension.testExtensionController._connectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const testActiveDBCodeLensProvider = new ActiveDBCodeLensProvider(
      mdbTestExtension.testExtensionController._connectionController
    );
    const testExportToLanguageCodeLensProvider =
      new ExportToLanguageCodeLensProvider();
    const testCodeActionProvider = new CodeActionProvider();
    const testExplorerController = new ExplorerController(
      mdbTestExtension.testExtensionController._connectionController
    );

    mdbTestExtension.testExtensionController._playgroundController =
      new PlaygroundController(
        mdbTestExtension.testExtensionController._connectionController,
        mdbTestExtension.testExtensionController._languageServerController,
        mdbTestExtension.testExtensionController._telemetryService,
        mdbTestExtension.testExtensionController._statusView,
        mdbTestExtension.testExtensionController._playgroundResultViewProvider,
        testActiveDBCodeLensProvider,
        testExportToLanguageCodeLensProvider,
        testCodeActionProvider,
        testExplorerController
      );

    const mockOpenPlaygroundResult: any = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._playgroundController,
      '_openPlaygroundResult',
      mockOpenPlaygroundResult
    );

    await vscode.workspace
      .getConfiguration('mdb')
      .update('confirmRunAll', false);

    await mdbTestExtension.testExtensionController._languageServerController.startLanguageServer();
    await mdbTestExtension.testExtensionController._playgroundController._connectToServiceProvider();
  });

  afterEach(async () => {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('confirmRunAll', true);
    await mdbTestExtension.testExtensionController._connectionController.disconnect();
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    sinon.restore();
  });

  test('returns undefined when text is not selected', () => {
    const testCodeActionProvider = new CodeActionProvider();
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
    const testCodeActionProvider = new CodeActionProvider();

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
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.selection =
      selection;
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.mode =
      mode;
    mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
      activeTextEditor;

    const testCodeActionProvider = new CodeActionProvider();
    testCodeActionProvider.refresh({ selection, mode });

    const codeActions = testCodeActionProvider.provideCodeActions();

    expect(codeActions).to.exist;

    if (codeActions) {
      expect(codeActions.length).to.be.equal(6);
      const actionCommand = codeActions[2].command;

      if (actionCommand) {
        expect(actionCommand.command).to.be.equal('mdb.exportToJava');
        expect(actionCommand.title).to.be.equal('Export To Java');
      }
    }
  });

  test('exports to java and includes builders', async () => {
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
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.selection =
      selection;
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.mode =
      mode;
    mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
      activeTextEditor;

    const testCodeActionProvider = new CodeActionProvider();
    testCodeActionProvider.refresh({ selection, mode });

    const codeActions = testCodeActionProvider.provideCodeActions();

    expect(codeActions).to.exist;

    if (codeActions) {
      expect(codeActions.length).to.be.equal(6);
      const actionCommand = codeActions[2].command;

      if (actionCommand) {
        expect(actionCommand.command).to.be.equal('mdb.exportToJava');
        expect(actionCommand.title).to.be.equal('Export To Java');

        await vscode.commands.executeCommand(actionCommand.command);

        const expectedResult = {
          namespace: 'DATABASE_NAME.COLLECTION_NAME',
          type: null,
          content: 'new Document("name", "22")',
          language: 'java',
        };

        const codeLenses =
          mdbTestExtension.testExtensionController._playgroundController._exportToLanguageCodeLensProvider.provideCodeLenses();
        expect(codeLenses.length).to.be.equal(3);

        // Only java queries supports builders.
        await vscode.commands.executeCommand(
          'mdb.changeExportToLanguageAddons',
          {
            ...mdbTestExtension.testExtensionController._playgroundController
              ._exportToLanguageCodeLensProvider._exportToLanguageAddons,
            builders: true,
          }
        );

        expectedResult.content = 'eq("name", "22")';
        expect(
          mdbTestExtension.testExtensionController._playgroundController
            ._playgroundResult
        ).to.be.deep.equal(expectedResult);
      }
    }
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
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.selection =
      selection;
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.mode =
      mode;
    mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
      activeTextEditor;

    const testCodeActionProvider = new CodeActionProvider();

    testCodeActionProvider.refresh({ selection, mode });

    const codeActions = testCodeActionProvider.provideCodeActions();

    expect(codeActions).to.exist;

    if (codeActions) {
      expect(codeActions.length).to.be.equal(6);
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
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.selection =
      selection;
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.mode =
      mode;
    mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
      activeTextEditor;

    const testCodeActionProvider = new CodeActionProvider();
    testCodeActionProvider.refresh({ selection, mode });

    const codeActions = testCodeActionProvider.provideCodeActions();

    expect(codeActions).to.exist;

    if (codeActions) {
      expect(codeActions.length).to.be.equal(6);
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
          content:
            "# Requires the PyMongo package.\n# https://api.mongodb.com/python/current\n\nclient = MongoClient('mongodb://localhost:27018/?appname=mongodb-vscode+0.0.0-dev.0')\nfilter={\n    'name': '22'\n}\n\nresult = client['db']['coll'].find(\n  filter=filter\n)",
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
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.selection =
      selection;
    mdbTestExtension.testExtensionController._playgroundController._codeActionProvider.mode =
      mode;
    mdbTestExtension.testExtensionController._playgroundController._activeTextEditor =
      activeTextEditor;

    const testCodeActionProvider = new CodeActionProvider();
    testCodeActionProvider.refresh({ selection, mode });

    const codeActions = testCodeActionProvider.provideCodeActions();

    expect(codeActions).to.exist;

    if (codeActions) {
      expect(codeActions.length).to.be.equal(6);
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
          content:
            "# Requires the MongoDB Ruby Driver\n# https://docs.mongodb.com/ruby-driver/master/\n\nclient = Mongo::Client.new('mongodb://localhost:27018/?appname=mongodb-vscode+0.0.0-dev.0', :database => 'db')\n\nresult = client.database['coll'].find({\n  'name' => '22'\n})",
          language: 'ruby',
        };

        expect(
          mdbTestExtension.testExtensionController._playgroundController
            ._playgroundResult
        ).to.be.deep.equal(expectedResult);
      }
    }
  });
});
