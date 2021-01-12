import * as vscode from 'vscode';
import assert from 'assert';
import { afterEach } from 'mocha';

import { EditorsController } from '../../../editors';

const sinon = require('sinon');
const chai = require('chai');
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
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        scheme: 'file',
        uri: {
          query: [
            'namespace=waffle.house',
            'connectionId=tasty_sandwhich',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a'
          ].join('&')
        }
      }
    }));

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and namespace is missing', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          scheme: 'VIEW_DOCUMENT_SCHEME',
          query: [
            'connectionId=tasty_sandwhich',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a'
          ].join('&')
        }
      }
    }));

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and connectionId is missing', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          scheme: 'VIEW_DOCUMENT_SCHEME',
          query: [
            'namespace=waffle.house',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a'
          ].join('&')
        }
      }
    }));

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if this is not a mongodb document and documentId is missing', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          scheme: 'VIEW_DOCUMENT_SCHEME',
          query: [
            'namespace=waffle.house',
            'connectionId=tasty_sandwhich'
          ].join('&')
        }
      }
    }));

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });

  test('saveMongoDBDocument returns false if a user saves an invalid javascript value', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          scheme: 'VIEW_DOCUMENT_SCHEME',
          query: [
            'namespace=waffle.house',
            'connectionId=tasty_sandwhich',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a'
          ].join('&')
        },
        getText: () => '{'
      }
    }));

    const result = await vscode.commands.executeCommand(
      'mdb.saveMongoDBDocument'
    );

    expect(result).to.be.equal(false);
  });
});
