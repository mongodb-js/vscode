import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import assert from 'assert';
import chai from 'chai';
import { mockTextEditor } from '../stubs';
import sinon from 'sinon';
import { ObjectId } from 'bson';

import EditorsController, {
  getFileDisplayNameForDocumentId
} from '../../../editors/editorsController';

const expect = chai.expect;

suite('Editors Controller Test Suite', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  suite('#getFileDisplayNameForDocumentId', () => {
    test('it strips special characters from the document id', () => {
      const str = 'abc//\\\nab  c$%%..@1s   df"';
      const result = getFileDisplayNameForDocumentId(str);
      const expected = '"abcnab  c1s   df""';
      assert.strictEqual(result, expected);
    });

    test('it trims the string to 50 characters', () => {
      const str = '123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdf';
      const result = getFileDisplayNameForDocumentId(str);
      const expected = '"123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjv';
      assert.strictEqual(result, expected);
    });

    test('it handles ids that are objects', () => {
      const str = {
        str: 'abc//\\\nab  c$%%..@1s   df"',
        b: new ObjectId('5d973ae744376d2aae72a160')
      };
      const result = getFileDisplayNameForDocumentId(str);
      const expected = '{"str":"abcnab  c1s   df"","b":{"oid":"5d973ae7443';
      assert.strictEqual(result, expected);
    });
  });

  test('getViewCollectionDocumentsUri builds a uri from the namespace and connection info', () => {
    const testOpId = '100011011101110011';
    const testNamespace = 'myFavoriteNamespace';
    const testConnectionId = 'alienSateliteConnection';
    const testUri = EditorsController.getViewCollectionDocumentsUri(
      testOpId,
      testNamespace,
      testConnectionId
    );

    assert(
      testUri.path === 'Results: myFavoriteNamespace.json',
      `Expected uri path ${testUri.path} to equal 'Results: myFavoriteNamespace.json'.`
    );
    assert(
      testUri.scheme === 'VIEW_COLLECTION_SCHEME',
      `Expected uri scheme ${testUri.scheme} to equal 'VIEW_COLLECTION_SCHEME'.`
    );
    assert(
      testUri.query ===
        'namespace=myFavoriteNamespace&connectionId=alienSateliteConnection&operationId=100011011101110011',
      `Expected uri query ${testUri.query} to equal 'namespace=myFavoriteNamespace&connectionId=alienSateliteConnection&operationId=100011011101110011'.`
    );
  });

  test('saveMongoDBDocument returns false if there is no active editor', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => undefined);

    const fakeShowErrorMessage: any = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeShowErrorMessage);

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
    expect(fakeShowErrorMessage.firstArg).to.be.equal(null);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse([
      'file:/',
      'waffle.house:pancakes.json?',
      'namespace=waffle.house&',
      'connectionId=tasty_sandwhich&',
      'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
      'source=treeview'
    ].join(''));
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => activeTextEditor);

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and namespace is missing', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse([
      'VIEW_DOCUMENT_SCHEME:/',
      'waffle.house:pancakes.json?',
      'connectionId=tasty_sandwhich&',
      'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
      'source=treeview'
    ].join(''));
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => activeTextEditor);

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and connectionId is missing', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse([
      'VIEW_DOCUMENT_SCHEME:/',
      'waffle.house:pancakes.json?',
      'namespace=waffle.house&',
      'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
      'source=treeview'
    ].join(''));
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => activeTextEditor);

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and documentId is missing', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse([
      'VIEW_DOCUMENT_SCHEME:/',
      'waffle.house:pancakes.json?',
      'namespace=waffle.house&',
      'connectionId=tasty_sandwhich&',
      'source=treeview'
    ].join(''));
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => activeTextEditor);

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if a user saves an invalid javascript value', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse([
      'VIEW_DOCUMENT_SCHEME:/',
      'waffle.house:pancakes.json?',
      'namespace=waffle.house&',
      'connectionId=tasty_sandwhich&',
      'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
      'source=treeview'
    ].join(''));
    activeTextEditor.document.getText = () => '{';
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => activeTextEditor);

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });
});
