import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import assert from 'assert';
import chai from 'chai';
import { mockTextEditor } from '../stubs';
import sinon from 'sinon';

import { EditorsController } from '../../../editors';

const expect = chai.expect;

suite('Editors Controller Test Suite', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
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
    sinon.replace(vscode.window, 'showErrorMessage', sinon.fake());

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
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
