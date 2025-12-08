import * as vscode from 'vscode';
import assert from 'assert';
import { beforeEach, afterEach } from 'mocha';
import chai from 'chai';
import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import { ObjectId } from 'bson';

import {
  getFileDisplayNameForDocument,
  getViewCollectionDocumentsUri,
} from '../../../editors/editorsController';
import { mockTextEditor } from '../stubs';

const expect = chai.expect;

suite('Editors Controller Test Suite', () => {
  const sandbox = sinon.createSandbox();
  let showErrorMessageStub: SinonStub;

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  suite('#getFileDisplayNameForDocumentId', () => {
    test('it strips special characters from the document id', () => {
      const str = 'abc//\\\nab  c"$%%..@1s   df""';
      const result = getFileDisplayNameForDocument(str, 'a.b');
      const expected =
        'a.b:"abc%2f%2f%5c%5c%5cnab  c%5c"$%25%25..@1s   df%5c"%5c""';
      assert.strictEqual(result, expected);
    });

    test('it trims the string to 200 characters', () => {
      const str =
        '123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdf123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdffbnjiekbfdakjsdbfkjsabdfkjasbfbnjiekbfdakjsdbfkjsabdfkjasbkjasbfbnjiekbfdakjsdbfkjsabdfkjasb';
      const result = getFileDisplayNameForDocument(str, 'db.col');
      const expected =
        'db.col:"123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdf123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdffbnjiekbfdakjsdbfkjsabdfkjasbfbnjiekbfdakjsdbfkjsabdfkjasbkjasbfbnjiekbfdakjsd';
      assert.strictEqual(result, expected);
    });

    test('it handles ids that are objects', () => {
      const str = {
        str: 'abc//\\\nab  c$%%..@1s   df"',
        b: new ObjectId('5d973ae744376d2aae72a160'),
      };
      const result = getFileDisplayNameForDocument(str, 'db.col');
      const expected =
        'db.col:{"str":"abc%2f%2f%5c%5c%5cnab  c$%25%25..@1s   df%5c"","b":{"$oid":"5d973ae744376d2aae72a160"}}';
      assert.strictEqual(result, expected);
    });

    test('has the namespace at the start of the display name', () => {
      const str = 'pineapples';
      const result = getFileDisplayNameForDocument(str, 'grilled');
      const expected = 'grilled:"pineapples"';
      assert.strictEqual(result, expected);
    });
  });

  test('getViewCollectionDocumentsUri builds a uri from the namespace and connection info', () => {
    const testOpId = '100011011101110011';
    const testNamespace = 'myFavoriteNamespace';
    const testConnectionId = 'alienSateliteConnection';
    const testUri = getViewCollectionDocumentsUri(
      testOpId,
      testNamespace,
      testConnectionId,
    );

    assert.strictEqual(testUri.path, 'Results: myFavoriteNamespace.json');
    assert.strictEqual(testUri.scheme, 'VIEW_COLLECTION_SCHEME');
    assert.strictEqual(
      testUri.query,
      'namespace=myFavoriteNamespace&connectionId=alienSateliteConnection&operationId=100011011101110011',
    );
  });

  test('getViewCollectionDocumentsUri handles / \\ and % in the namespace', () => {
    const testOpId = '100011011101110011';
    const testNamespace = 'myFa%%\\\\///\\%vorite%Namespace';
    const testConnectionId = 'alienSateliteConnection';
    const testUri = getViewCollectionDocumentsUri(
      testOpId,
      testNamespace,
      testConnectionId,
    );

    assert.strictEqual(
      testUri.path,
      'Results: myFa%25%25%5c%5c%2f%2f%2f%5c%25vorite%25Namespace.json',
    );
    assert.strictEqual(testUri.scheme, 'VIEW_COLLECTION_SCHEME');
    assert.strictEqual(
      testUri.query,
      'namespace=myFa%%\\\\///\\%vorite%Namespace&connectionId=alienSateliteConnection&operationId=100011011101110011',
    );
  });

  test('saveMongoDBDocument returns false if there is no active editor', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => undefined);

    // Stub the built-in save command to prevent it from blocking in tests
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
    executeCommandStub
      .withArgs('workbench.action.files.save')
      .resolves(undefined);
    executeCommandStub.callThrough();

    const result = await executeCommandStub('mdb.saveMongoDBDocument');

    expect(result).to.be.equal(false);
    expect(showErrorMessageStub.notCalled).to.be.equal(true);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse(
      [
        'file:/',
        'waffle.house:pancakes.json?',
        'namespace=waffle.house&',
        'connectionId=tasty_sandwhich&',
        'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
        'source=treeview',
      ].join(''),
    );
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () => activeTextEditor,
    );

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument',
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and namespace is missing', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse(
      [
        'VIEW_DOCUMENT_SCHEME:/',
        'waffle.house:pancakes.json?',
        'connectionId=tasty_sandwhich&',
        'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
        'source=treeview',
      ].join(''),
    );
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () => activeTextEditor,
    );

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument',
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and connectionId is missing', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse(
      [
        'VIEW_DOCUMENT_SCHEME:/',
        'waffle.house:pancakes.json?',
        'namespace=waffle.house&',
        'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
        'source=treeview',
      ].join(''),
    );
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () => activeTextEditor,
    );

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument',
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and documentId is missing', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse(
      [
        'VIEW_DOCUMENT_SCHEME:/',
        'waffle.house:pancakes.json?',
        'namespace=waffle.house&',
        'connectionId=tasty_sandwhich&',
        'source=treeview',
      ].join(''),
    );
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () => activeTextEditor,
    );

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument',
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if a user saves an invalid javascript value', async () => {
    const activeTextEditor = mockTextEditor;
    activeTextEditor.document.uri = vscode.Uri.parse(
      [
        'VIEW_DOCUMENT_SCHEME:/',
        'waffle.house:pancakes.json?',
        'namespace=waffle.house&',
        'connectionId=tasty_sandwhich&',
        'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a&',
        'source=treeview',
      ].join(''),
    );
    activeTextEditor.document.getText = (): string => '{';
    sandbox.replaceGetter(
      vscode.window,
      'activeTextEditor',
      () => activeTextEditor,
    );

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument',
    );

    expect(result).to.be.equal(false);
  });
});
