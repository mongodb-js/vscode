import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';

import { mdbTestExtension } from './stubbableMdbExtension';
import {
  disposeAll,
  getFullRange,
  typeCommitCharacter,
  acceptFirstSuggestion,
} from './suggestTestHelpers';

const expect = chai.expect;
chai.use(require('chai-as-promised'));

const TEST_DATABASE_URI = 'mongodb://localhost:27018';

suite('e2e', function () {
  this.timeout(8000);

  const _disposables: vscode.Disposable[] = [];
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'connectWithURI',
      sandbox.fake()
    );

    const mockDocument = {
      _id: 'pancakes',
      name: 'name',
      time: {
        $time: '12345',
      },
    };
    const fakeGetMongoClientConnectionOptions = sandbox.fake.returns({
      url: TEST_DATABASE_URI,
      options: {},
    });
    const fakeGetActiveDataService = sandbox.fake.returns({
      find: () => {
        return Promise.resolve([mockDocument]);
      },
    });
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveDataService',
      fakeGetActiveDataService
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionName',
      sandbox.fake.returns('localhost:27018')
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      sandbox.fake.returns('fake_active_connection_id')
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isCurrentlyConnected',
      () => true
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getMongoClientConnectionOptions',
      fakeGetMongoClientConnectionOptions
    );

    await mdbTestExtension.testExtensionController._playgroundController._connectToServiceProvider();
    await mdbTestExtension.testExtensionController._playgroundController._languageServerController.updateCurrentSessionFields(
      {
        namespace: 'mongodbVSCodePlaygroundDB.sales',
        schemaFields: ['_id', 'name', 'time'],
      }
    );
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    disposeAll(_disposables);
    sandbox.restore();
  });

  test('show mongodb completion items before other js completion', async () => {
    const inputBoxResolvesStub = sandbox.stub();
    inputBoxResolvesStub.onCall(0).resolves(TEST_DATABASE_URI);
    sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

    await vscode.commands.executeCommand('mdb.connectWithURI');
    await vscode.commands.executeCommand('mdb.createPlayground');

    const editor = vscode.window.activeTextEditor;
    expect(editor).to.be.exist;

    if (!editor) {
      return;
    }

    const testDocumentUri = editor.document.uri;

    // Modify initial content.
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      testDocumentUri,
      getFullRange(editor.document),
      "use('mongodbVSCodePlaygroundDB'); db.sales.find({ });"
    );
    await vscode.workspace.applyEdit(edit);

    // Move to a field name position inside of find.
    const position = editor.selection.active;
    const newPosition = position.with(0, 50);
    const newSelection = new vscode.Selection(newPosition, newPosition);
    editor.selection = newSelection;

    await typeCommitCharacter(testDocumentUri, 'n', _disposables);
    await acceptFirstSuggestion(testDocumentUri, _disposables);

    expect(editor.document.getText()).to.be.eql(
      "use('mongodbVSCodePlaygroundDB'); db.sales.find({ name});"
    );
  });
});
