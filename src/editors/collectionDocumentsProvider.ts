import { URLSearchParams } from 'url';
import * as vscode from 'vscode';
import { EJSON } from 'bson';

import CollectionDocumentsOperationsStore from './collectionDocumentsOperationsStore';
import ConnectionController from '../connectionController';

export const NAMESPACE_URI_IDENTIFIER = 'namespace';
export const OPERATION_ID_URI_IDENTIFIER = 'operationId';
export const CONNECTION_ID_URI_IDENTIFIER = 'connectionId';

export const VIEW_COLLECTION_SCHEME = 'VIEW_COLLECTION_SCHEME';

export default class CollectionViewProvider implements vscode.TextDocumentContentProvider {
  _connectionController: ConnectionController;
  _operationsStore: CollectionDocumentsOperationsStore;

  constructor(connectionController: ConnectionController, operationsStore: CollectionDocumentsOperationsStore) {
    this._connectionController = connectionController;
    this._operationsStore = operationsStore;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return new Promise((resolve, reject) => {
      const uriParams = new URLSearchParams(uri.query);
      const namespace = String(uriParams.get(NAMESPACE_URI_IDENTIFIER));
      const connectionInstanceId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
      const operationId = uriParams.get(OPERATION_ID_URI_IDENTIFIER);

      if (!operationId) {
        vscode.window.showErrorMessage('Unable to list documents: invalid operation');
        return reject('Unable to list documents: invalid operation');
      }

      const operation = this._operationsStore.operations[operationId];
      const documentLimit = operation.currentLimit;

      // Ensure we're still connected to the correct connection.
      if (connectionInstanceId !== this._connectionController.getActiveConnectionInstanceId()) {
        operation.isCurrentlyFetchingMoreDocuments = false;
        vscode.window.showErrorMessage(`Unable to list documents: no longer connected to ${connectionInstanceId}`);
        return reject(`Unable to list documents: no longer connected to ${connectionInstanceId}`);
      }

      const dataservice = this._connectionController.getActiveConnection();
      dataservice.find(
        namespace,
        {}, // No filter.
        {
          limit: documentLimit
        },
        (err: Error, documents: []) => {
          operation.isCurrentlyFetchingMoreDocuments = false;

          if (err) {
            vscode.window.showErrorMessage(`Unable to list documents: ${err}`);
            return reject(`Unable to list documents: ${err}`);
          }

          if (documents.length !== documentLimit) {
            operation.hasMoreDocumentsToShow = false;
          }

          return resolve(EJSON.stringify(documents, null, 2));
        }
      );
    });
  }
}
