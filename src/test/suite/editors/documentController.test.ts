import * as vscode from 'vscode';
import DocumentController from '../../../editors/documentController';
import DocumentIdStore from '../../../editors/documentIdStore';
import ConnectionController from '../../../connectionController';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';
import { StatusView } from '../../../views';
import TelemetryController from '../../../telemetry/telemetryController';
import { afterEach } from 'mocha';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

suite('Document Controller Test Suite', () => {
  const testDocumentIdStore = new DocumentIdStore();
  const mockExtensionContext = new TestExtensionContext();
  const testStorageController = new StorageController(mockExtensionContext);
  const testStatusView = new StatusView(mockExtensionContext);
  const testTelemetryController = new TelemetryController(
    testStorageController,
    mockExtensionContext
  );
  const testConnectionController = new ConnectionController(
    testStatusView,
    testStorageController,
    testTelemetryController
  );
  const testDocumentController = new DocumentController(
    testDocumentIdStore,
    testConnectionController,
    testStatusView,
    testTelemetryController
  );
  const mockDocument = {
    _id: 'abc',
    name: '',
    time: {
      $time: '12345'
    }
  };

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  test('returns false if there is no active editor', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => undefined);

    const result = await testDocumentController.saveDocumentToMongoDB();

    expect(result).to.be.equal(false);
  });

  test('returns false if this is not a mongodb document and documentLocation is missing', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          query: [
            'namespace=waffle.house',
            'connectionId=tasty_sandwhich',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a'
          ].join('&')
        }
      }
    }));

    const result = await testDocumentController.saveDocumentToMongoDB();

    expect(result).to.be.equal(false);
  });

  test('returns false if documentLocation is not mongodb', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          query: [
            '?documentLocation=other',
            'namespace=waffle.house',
            'connectionId=tasty_sandwhich',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a'
          ].join('&')
        }
      }
    }));

    const result = await testDocumentController.saveDocumentToMongoDB();

    expect(result).to.be.equal(false);
  });

  test('returns false if this is not a mongodb document and namespace is missing', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          query: [
            '?documentLocation=mongodb',
            'connectionId=tasty_sandwhich',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a'
          ].join('&')
        }
      }
    }));

    const result = await testDocumentController.saveDocumentToMongoDB();

    expect(result).to.be.equal(false);
  });

  test('returns false if this is not a mongodb document and connectionId is missing', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          query: [
            '?documentLocation=mongodb',
            'namespace=waffle.house',
            'documentId=93333a0d-83f6-4e6f-a575-af7ea6187a4a'
          ].join('&')
        }
      }
    }));

    const result = await testDocumentController.saveDocumentToMongoDB();

    expect(result).to.be.equal(false);
  });

  test('returns false if this is not a mongodb document and documentId is missing', async () => {
    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          query: [
            '?documentLocation=mongodb',
            'namespace=waffle.house',
            'connectionId=tasty_sandwhich'
          ].join('&')
        }
      }
    }));

    const result = await testDocumentController.saveDocumentToMongoDB();

    expect(result).to.be.equal(false);
  });
});
