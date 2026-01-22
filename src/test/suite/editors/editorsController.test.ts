import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import type { SinonStub } from 'sinon';

import { getViewCollectionDocumentsUri } from '../../../editors/editorsController';
import { mockTextEditor } from '../stubs';

suite('Editors Controller Test Suite', function () {
  const sandbox = sinon.createSandbox();
  let showErrorMessageStub: SinonStub;

  beforeEach(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  test('getViewCollectionDocumentsUri builds a uri from the namespace and connection info', function () {
    const testOpId = '100011011101110011';
    const testNamespace = 'myFavoriteNamespace';
    const testConnectionId = 'alienSateliteConnection';
    const testUri = getViewCollectionDocumentsUri({
      editFormat: 'ejson',
      operationId: testOpId,
      namespace: testNamespace,
      connectionId: testConnectionId,
    });

    expect(testUri.path).to.equal('Results: myFavoriteNamespace.json');
    expect(testUri.scheme).to.equal('VIEW_COLLECTION_SCHEME');
    expect(
      testUri.query,
      'namespace=myFavoriteNamespace&connectionId=alienSateliteConnection&operationId=100011011101110011&format=ejson',
    );
  });

  test('getViewCollectionDocumentsUri builds a uri with shell format', function () {
    const testOpId = '100011011101110011';
    const testNamespace = 'myFavoriteNamespace';
    const testConnectionId = 'alienSateliteConnection';
    const testUri = getViewCollectionDocumentsUri({
      editFormat: 'shell',
      operationId: testOpId,
      namespace: testNamespace,
      connectionId: testConnectionId,
    });

    expect(testUri.path).to.equal('Results: myFavoriteNamespace');
    expect(testUri.scheme).to.equal('VIEW_COLLECTION_SCHEME');
    expect(testUri.query).to.equal(
      'namespace=myFavoriteNamespace&connectionId=alienSateliteConnection&operationId=100011011101110011&format=shell',
    );
  });

  test('getViewCollectionDocumentsUri handles / \\ and % in the namespace', function () {
    const testOpId = '100011011101110011';
    const testNamespace = 'myFa%%\\\\///\\%vorite%Namespace';
    const testConnectionId = 'alienSateliteConnection';
    const testUri = getViewCollectionDocumentsUri({
      editFormat: 'ejson',
      operationId: testOpId,
      namespace: testNamespace,
      connectionId: testConnectionId,
    });

    expect(testUri.path).to.equal(
      'Results: myFa%25%25%5c%5c%2f%2f%2f%5c%25vorite%25Namespace.json',
    );
    expect(testUri.scheme).to.equal('VIEW_COLLECTION_SCHEME');
    expect(testUri.query).to.equal(
      'namespace=myFa%%\\\\///\\%vorite%Namespace&connectionId=alienSateliteConnection&operationId=100011011101110011&format=ejson',
    );
  });

  test('saveMongoDBDocument returns false if there is no active editor', async function () {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => undefined);

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument',
    );

    expect(result).to.be.equal(false);
    expect(showErrorMessageStub.notCalled).to.be.equal(true);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document', async function () {
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

  test('saveMongoDBDocument returns false if this is not a mongodb document and namespace is missing', async function () {
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

  test('saveMongoDBDocument returns false if this is not a mongodb document and connectionId is missing', async function () {
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

  test('saveMongoDBDocument returns false if this is not a mongodb document and documentId is missing', async function () {
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

  test('saveMongoDBDocument returns false if a user saves an invalid javascript value', async function () {
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
