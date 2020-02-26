import * as vscode from 'vscode';

import CollectionDocumentsCodeLensProvider from './collectionDocumentsCodeLensProvider';
import CollectionDocumentsOperationsStore from './collectionDocumentsOperationsStore';
import CollectionDocumentsProvider, {
  CONNECTION_ID_URI_IDENTIFIER,
  OPERATION_ID_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER,
  VIEW_COLLECTION_SCHEME
} from './collectionDocumentsProvider';
import ConnectionController from '../connectionController';
import { createLogger } from '../logging';

const log = createLogger('editors controller');

/**
 * This controller manages when our extension needs to open
 * new editors and the data they need. It also manages active editors.
 */
export default class EditorsController {
  _connectionController?: ConnectionController;
  _collectionDocumentsOperationsStore = new CollectionDocumentsOperationsStore();

  _collectionViewProvider?: CollectionDocumentsProvider;

  activate(context: vscode.ExtensionContext, connectionController: ConnectionController): void {
    log.info('activating...');
    const collectionViewProvider = new CollectionDocumentsProvider(
      connectionController,
      this._collectionDocumentsOperationsStore
    );

    this._connectionController = connectionController;

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        VIEW_COLLECTION_SCHEME, collectionViewProvider
      )
    );
    this._collectionViewProvider = collectionViewProvider;

    context.subscriptions.push(vscode.languages.registerCodeLensProvider(
      {
        scheme: VIEW_COLLECTION_SCHEME,
        language: 'json'
      },
      new CollectionDocumentsCodeLensProvider(this._collectionDocumentsOperationsStore)
    ));

    log.info('activated.');
  }

  // ‍‍vscode.workspace.onDidCloseTextDocument to delete our store of queries.

  getViewCollectionDocumentsUri(operationId, namespace, connectionId): vscode.Uri {
    // We attach a unique id to the query so that it creates a new file in
    // the editor and so that we can virtually manage the amount of docs shown.
    const operationIdUriQuery = `${OPERATION_ID_URI_IDENTIFIER}=${operationId}`;

    const connectionIdUriQuery = `${CONNECTION_ID_URI_IDENTIFIER}=${connectionId}`;
    const namespaceUriQuery = `${NAMESPACE_URI_IDENTIFIER}=${namespace}`;
    const uriQuery = `?${namespaceUriQuery}&${connectionIdUriQuery}&${operationIdUriQuery}`;

    // The part of the URI after the scheme and before the query is the file name.
    return vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${namespace}.json${uriQuery}`
    );
  }

  onViewCollectionDocuments(namespace: string): Thenable<void> {
    log.info('view collection documents');
    if (!this._connectionController) {
      return Promise.reject('No connection controller');
    }

    const operationId = this._collectionDocumentsOperationsStore.createNewOperation();

    const uri = this.getViewCollectionDocumentsUri(
      operationId,
      namespace,
      this._connectionController.getActiveConnectionInstanceId()
    );
    return new Promise((resolve, reject) => {
      vscode.workspace.openTextDocument(uri).then((doc) => {
        vscode.window.showTextDocument(doc, { preview: false }).then(
          () => resolve(),
          reject
        );
      }, reject);
    });
  }

  onViewMoreCollectionDocuments(operationId: string, connectionId: string, namespace: string): void {
    log.info('view more collection documents');

    if (this._collectionDocumentsOperationsStore.operations[operationId].isCurrentlyFetchingMoreDocuments) {
      // A user might click to fetch more documents multiple times,
      // this ensures it only performs one fetch at a time.
      return;
    }

    // Ensure we're still connected to the correct connection.
    if (!this._connectionController
      || connectionId !== this._connectionController.getActiveConnectionInstanceId()
    ) {
      vscode.window.showErrorMessage(`Unable to view more documents: no longer connected to ${connectionId}`);
      return;
    }

    if (!this._collectionViewProvider) {
      return;
    }

    const uri = this.getViewCollectionDocumentsUri(
      operationId,
      namespace,
      connectionId
    );

    this._collectionDocumentsOperationsStore.increaseOperationDocumentLimit(operationId);

    // Notify the document provider to update with the new document limit.
    this._collectionViewProvider.onDidChangeEmitter.fire(uri);
  }
}
