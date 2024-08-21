import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';

import ActiveConnectionCodeLensProvider from '../../../editors/activeConnectionCodeLensProvider';
import PlaygroundSelectedCodeActionProvider from '../../../editors/playgroundSelectedCodeActionProvider';
import { LanguageServerController } from '../../../language';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { PlaygroundController } from '../../../editors';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { ExtensionContextStub } from '../stubs';

const emptySelection = new vscode.Selection(
  new vscode.Position(0, 0),
  new vscode.Position(0, 0)
);
const fourCharacterSelection = new vscode.Selection(
  new vscode.Position(0, 0),
  new vscode.Position(0, 4)
);

suite('Playground Selected CodeAction Provider Test Suite', function () {
  this.timeout(5000);
  const sandbox = sinon.createSandbox();

  afterEach(function () {
    sandbox.restore();
  });

  const extensionContextStub = new ExtensionContextStub();

  // The test extension runner.
  extensionContextStub.extensionPath = '../../';

  suite('the MongoDB playground in JS', () => {
    const testCodeActionProvider = new PlaygroundSelectedCodeActionProvider();
    const mockFileName = path.join('nonexistent', 'playground-test.mongodb.js');
    const mockDocumentUri = vscode.Uri.from({
      path: mockFileName,
      scheme: 'untitled',
    });
    const mockTextDoc: vscode.TextDocument = {
      uri: mockDocumentUri,
    } as Pick<vscode.TextDocument, 'uri'> as vscode.TextDocument;

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
    });

    test('returns undefined when text is not selected', () => {
      const codeActions = testCodeActionProvider.provideCodeActions(
        mockTextDoc,
        emptySelection
      );
      expect(codeActions).to.be.undefined;
    });

    test('returns a run selected playground blocks action', async () => {
      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        '123';

      const codeActions = testCodeActionProvider.provideCodeActions(
        mockTextDoc,
        fourCharacterSelection
      );
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
  });

  suite('the regular JS file', () => {
    const testCodeActionProvider = new PlaygroundSelectedCodeActionProvider();
    const mockFileName = path.join('nonexistent', 'playground-test.js');
    const mockDocumentUri = vscode.Uri.from({
      path: mockFileName,
      scheme: 'untitled',
    });
    const mockTextDoc: vscode.TextDocument = {
      uri: mockDocumentUri,
    } as Pick<vscode.TextDocument, 'uri'> as vscode.TextDocument;

    beforeEach(() => {
      sandbox.stub(
        mdbTestExtension.testExtensionController._telemetryService,
        'trackNewConnection'
      );
    });

    test('returns undefined when text is not selected', () => {
      const codeActions = testCodeActionProvider.provideCodeActions(
        mockTextDoc,
        emptySelection
      );
      expect(codeActions).to.be.undefined;
    });

    test('returns undefined when text is selected', () => {
      mdbTestExtension.testExtensionController._playgroundController._selectedText =
        '123';

      const codeActions = testCodeActionProvider.provideCodeActions(
        mockTextDoc,
        fourCharacterSelection
      );
      expect(codeActions).to.be.undefined;
    });
  });
});
