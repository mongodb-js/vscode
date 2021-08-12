import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';

import ActiveDBCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import CodeActionProvider from '../../../editors/codeActionProvider';
import { ExplorerController } from '../../../explorer';
import { LanguageServerController } from '../../../language';
import { PlaygroundController } from '../../../editors';

import { mdbTestExtension } from '../stubbableMdbExtension';
import { TestExtensionContext } from '../stubs';

const expect = chai.expect;

import { TEST_DATABASE_URI } from '../dbTestHelper';

suite('Code Action Provider Test Suite', function () {
  this.timeout(5000);

  const testExtensionContext = new TestExtensionContext();
  testExtensionContext.extensionPath = '../../';

  beforeEach(async () => {
    sinon.replace(
      mdbTestExtension.testExtensionController,
      '_languageServerController',
      new LanguageServerController(
        testExtensionContext
      )
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
    const testExplorerController = new ExplorerController(
      mdbTestExtension.testExtensionController._connectionController
    );

    mdbTestExtension.testExtensionController._playgroundController = new PlaygroundController(
      testExtensionContext,
      mdbTestExtension.testExtensionController._connectionController,
      mdbTestExtension.testExtensionController._languageServerController,
      mdbTestExtension.testExtensionController._telemetryService,
      mdbTestExtension.testExtensionController._statusView,
      mdbTestExtension.testExtensionController._playgroundResultViewProvider,
      testActiveDBCodeLensProvider,
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

  test('expected provideCodeActions to return undefined when text is not selected', () => {
    const testCodeActionProvider = new CodeActionProvider(mdbTestExtension.testExtensionController._playgroundController);
    const codeActions = testCodeActionProvider.provideCodeActions();

    expect(codeActions).to.be.undefined;
  });

  test('expected provideCodeActions to return a run selected playground blocks action', async () => {
    mdbTestExtension.testExtensionController._playgroundController._selectedText = '123';

    const testCodeActionProvider = new CodeActionProvider(mdbTestExtension.testExtensionController._playgroundController);
    const codeActions = testCodeActionProvider.provideCodeActions();

    expect(codeActions).to.exist;

    if (codeActions) {
      expect(codeActions.length).to.be.equal(1);
      const actionCommand = codeActions[0].command;
      expect(actionCommand?.command).to.be.equal('mdb.runSelectedPlaygroundBlocks');
      expect(actionCommand?.title).to.be.equal('Run selected playground blocks');

      await vscode.commands.executeCommand('mdb.runSelectedPlaygroundBlocks');

      const expectedResult = { namespace: null, type: 'number', content: 123 };
      expect(mdbTestExtension.testExtensionController._playgroundController._playgroundResult).to.be.deep.equal(expectedResult);
      expect(mdbTestExtension.testExtensionController._playgroundController._isPartialRun).to.be.equal(true);
    }
  });
});
