import { URLSearchParams } from 'url';
import * as vscode from 'vscode';

import CollectionDocumentsOperationsStore from './collectionDocumentsOperationsStore';
import ConnectionController from '../connectionController';
import { StatusView } from '../views';

export const NAMESPACE_URI_IDENTIFIER = 'namespace';
export const OPERATION_ID_URI_IDENTIFIER = 'operationId';
export const CONNECTION_ID_URI_IDENTIFIER = 'connectionId';

export const VIEW_COLLECTION_SCHEME = 'VIEW_COLLECTION_SCHEME';

export default class CollectionViewProvider implements vscode.TextDocumentContentProvider {
  _connectionController: ConnectionController;
  _operationsStore: CollectionDocumentsOperationsStore;
  _statusView: StatusView;

  constructor(
    connectionController: ConnectionController,
    operationsStore: CollectionDocumentsOperationsStore,
    statusView: StatusView
  ) {
    this._connectionController = connectionController;
    this._operationsStore = operationsStore;
    this._statusView = statusView;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return new Promise((resolve, reject) => {
      const uriParams = new URLSearchParams(uri.query);
      const namespace = String(uriParams.get(NAMESPACE_URI_IDENTIFIER));
      const connectionId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
      const operationId = uriParams.get(OPERATION_ID_URI_IDENTIFIER);

      if (!operationId) {
        vscode.window.showErrorMessage(
          'Unable to list documents: invalid operation'
        );
        return reject(new Error('Unable to list documents: invalid operation'));
      }

      const operation = this._operationsStore.operations[operationId];
      const documentLimit = operation.currentLimit;

      // Ensure we're still connected to the correct connection.
      if (connectionId !== this._connectionController.getActiveConnectionId()) {
        operation.isCurrentlyFetchingMoreDocuments = false;
        vscode.window.showErrorMessage(
          `Unable to list documents: no longer connected to ${connectionId}`
        );
        return reject(
          new Error(
            `Unable to list documents: no longer connected to ${connectionId}`
          )
        );
      }

      this._statusView.showMessage('Fetching documents...');

      const dataservice = this._connectionController.getActiveDataService();
      if (dataservice === null) {
        const errorMessage = `Unable to list documents: no longer connected to ${connectionId}`;
        vscode.window.showErrorMessage(errorMessage);
        return reject(new Error(errorMessage));
      }
      dataservice.find(
        namespace,
        {}, // No filter.
        {
          limit: documentLimit
        },
        (err: Error | undefined, documents: object[]) => {
          operation.isCurrentlyFetchingMoreDocuments = false;
          this._statusView.hideMessage();

          if (err) {
            const errorMessage = `Unable to list documents: ${err.message}`;
            vscode.window.showErrorMessage(errorMessage);
            return reject(new Error(errorMessage));
          }

          if (documents.length !== documentLimit) {
            operation.hasMoreDocumentsToShow = false;
          }

          return resolve(JSON.stringify(documents, null, 2));
        }
      );
    });
  }
}
