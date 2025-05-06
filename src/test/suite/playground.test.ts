import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { mdbTestExtension } from './stubbableMdbExtension';
import {
  disposeAll,
  getFullRange,
  typeCommitCharacter,
  acceptFirstSuggestion,
} from './suggestTestHelpers';

const expect = chai.expect;
chai.use(chaiAsPromised);

const TEST_DATABASE_URI = 'mongodb://localhost:27088';

suite('Playground', function () {
  this.timeout(8000);

  const _disposables: vscode.Disposable[] = [];
  const sandbox = sinon.createSandbox();
  let showErrorMessageStub: SinonStub;

  beforeEach(async () => {
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'connectWithURI',
      sandbox.fake(),
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
      fakeGetActiveDataService,
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionName',
      sandbox.fake.returns('localhost:27088'),
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getActiveConnectionId',
      sandbox.fake.returns('fake_active_connection_id'),
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'isCurrentlyConnected',
      () => true,
    );
    sandbox.replace(
      mdbTestExtension.testExtensionController._connectionController,
      'getMongoClientConnectionOptions',
      fakeGetMongoClientConnectionOptions,
    );
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

    await mdbTestExtension.testExtensionController._playgroundController._activeConnectionChanged();
    await mdbTestExtension.testExtensionController._playgroundController._languageServerController.updateCurrentSessionFields(
      {
        namespace: 'mongodbVSCodePlaygroundDB.sales',
        schemaFields: ['_id', 'name', 'time'],
      },
    );
    await vscode.workspace
      .getConfiguration('mdb')
      .update('confirmRunAll', false);
  });

  afterEach(async function () {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    disposeAll(_disposables);
    sandbox.restore();
  });

  test('shows mongodb completion items before other js completion', async function () {
    this.timeout(20000);
    await vscode.commands.executeCommand('mdb.createPlayground');

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('Window active text editor is undefined');
    }

    const testDocumentUri = editor.document.uri;

    // Modify initial content.
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      testDocumentUri,
      getFullRange(editor.document),
      "use('mongodbVSCodePlaygroundDB'); db.sales.find({ });",
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
      "use('mongodbVSCodePlaygroundDB'); db.sales.find({ name});",
    );
  });

  test('restores the language server when the out of memory error occurred', async function () {
    this.timeout(30000);
    await vscode.commands.executeCommand('mdb.createPlayground');

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('Window active text editor is undefined');
    }

    const testDocumentUri = editor.document.uri;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      testDocumentUri,
      getFullRange(editor.document),
      "use('test'); const mockDataArray = []; for(let i = 0; i < 50000; i++) { mockDataArray.push(Math.random() * 10000); } const docs = []; for(let i = 0; i < 10000000; i++) { docs.push({ mockData: [...mockDataArray], a: 'test 123', b: Math.ceil(Math.random() * 10000) }); }",
    );
    await vscode.workspace.applyEdit(edit);
    await vscode.commands.executeCommand('mdb.runPlayground');

    const onDidChangeDiagnostics = (): Promise<unknown> =>
      new Promise((resolve) => {
        // The diagnostics are set again when the server restarts.
        vscode.languages.onDidChangeDiagnostics(resolve);
      });
    await onDidChangeDiagnostics();

    expect(showErrorMessageStub.calledOnce).to.equal(true);
    expect(showErrorMessageStub.firstCall.args[0]).to.equal(
      'An internal error has occurred. The playground services have been restored. This can occur when the playground runner runs out of memory.',
    );
  });
});
