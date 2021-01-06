import * as vscode from 'vscode';
import DocumentController from '../../../editors/documentController';
import DocumentIdStore from '../../../editors/documentIdStore';
import ConnectionController from '../../../connectionController';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';
import { StatusView } from '../../../views';
import TelemetryController from '../../../telemetry/telemetryController';
import { afterEach } from 'mocha';
import { MemoryFileSystemProvider } from '../../../editors/memoryFileSystemProvider';
import DataService from 'mongodb-data-service';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

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
  const testMemoryFileSystemProvider = new MemoryFileSystemProvider();
  const testDocumentController = new DocumentController(
    mockExtensionContext,
    testDocumentIdStore,
    testConnectionController,
    testStatusView,
    testTelemetryController,
    testMemoryFileSystemProvider
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

    const result = await testDocumentController.saveMongoDBDocument();

    expect(result).to.be.equal(false);
  });

  test('returns false if this is not a mongodb document', async () => {
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

    const result = await testDocumentController.saveMongoDBDocument();

    expect(result).to.be.equal(false);
  });

  test('returns false if this is not a mongodb document and namespace is missing', async () => {
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

    const result = await testDocumentController.saveMongoDBDocument();

    expect(result).to.be.equal(false);
  });

  test('returns false if this is not a mongodb document and connectionId is missing', async () => {
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

    const result = await testDocumentController.saveMongoDBDocument();

    expect(result).to.be.equal(false);
  });

  test('returns false if this is not a mongodb document and documentId is missing', async () => {
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

    const result = await testDocumentController.saveMongoDBDocument();

    expect(result).to.be.equal(false);
  });

  test('replaceDocument returns result after findOneAndReplace completes', async () => {
    const namespace = 'waffle.house';
    const connectionId = 'tasty_sandwhich';
    const documentId = '93333a0d-83f6-4e6f-a575-af7ea6187a4a';
    const sequenceOfElements: string[] = [];

    const mockGetActiveDataService = {
      findOneAndReplace: async (
        namespace: string,
        filter: object,
        replacement: object,
        options: object,
        callback: (error: Error | undefined, result: object) => void
      ) => {
        await sleep(100);
        sequenceOfElements.push('should be first');
        callback(undefined, { _id: '123' });
      }
    } as DataService;

    const mockShowMessage = sinon.fake();
    sinon.replace(testStatusView, 'showMessage', mockShowMessage);

    const mockHideMessage = sinon.fake();
    sinon.replace(testStatusView, 'hideMessage', mockHideMessage);

    sandbox.replaceGetter(vscode.window, 'activeTextEditor', () => ({
      document: {
        uri: {
          scheme: 'VIEW_DOCUMENT_SCHEME',
          query: [
            `namespace=${namespace}`,
            `connectionId=${connectionId}`,
            `documentId=${documentId}`
          ].join('&')
        },
        getText: () => JSON.stringify(mockDocument),
        save: () => {}
      }
    }));

    const result = await testDocumentController._replaceDocument({
      namespace,
      documentId,
      dataservice: mockGetActiveDataService
    });

    sequenceOfElements.push('should be second');

    expect(result).to.be.equal(true);
    expect(sequenceOfElements[0]).to.be.equal('should be first');
    expect(sequenceOfElements[1]).to.be.equal('should be second');
  });
});
