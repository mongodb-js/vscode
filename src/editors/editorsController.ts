import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import CollectionDocumentsProvider, {
  CONNECTION_ID_URI_IDENTIFIER,
  DOC_LIMIT_URI_IDENTIFIER,
  DOCUMENTS_LIMIT,
  NAMESPACE_URI_IDENTIFIER,
  VIEW_COLLECTION_SCHEME
} from './collectionDocumentsProvider';
import { createLogger } from '../logging';

const log = createLogger('editors controller');

/**
 * This controller manages when our extension needs to open
 * new editors and the data they need. It also manages active editors.
 */
export default class EditorsController {
  _connectionController?: ConnectionController;

  activate(context: vscode.ExtensionContext, connectionController: ConnectionController): void {
    log.info('activating...');
    const collectionViewProvider = new CollectionDocumentsProvider(connectionController);

    this._connectionController = connectionController;

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        VIEW_COLLECTION_SCHEME, collectionViewProvider
      )
    );

    log.info('activated.');
  }

  // ‍‍vscode.workspace.onDidCloseTextDocument to close cursors.
  // keep active cursors.

  onViewCollectionDocuments(namespace: string): Thenable<void> {
    if (!this._connectionController) {
      return Promise.reject('No connection controller');
    }

    const connectionIdUriQuery = `${CONNECTION_ID_URI_IDENTIFIER}=${this._connectionController.getActiveConnectionInstanceId()}`;
    const docLimitUriQuery = `${DOC_LIMIT_URI_IDENTIFIER}=${DOCUMENTS_LIMIT}`;
    const namespaceUriQuery = `${NAMESPACE_URI_IDENTIFIER}=${namespace}`;
    const uriQuery = `?${namespaceUriQuery}&${connectionIdUriQuery}&${docLimitUriQuery}`;
    // We attach the current time to ensure a new editor window is opened on
    // each query and maybe help the user know when the query started.
    // The part of the URI after the scheme and before the query is the file name.

    // ${Date.now()}
    const uri = vscode.Uri.parse(
      `${VIEW_COLLECTION_SCHEME}:Results: ${namespace}.json${uriQuery}`
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

  onViewMoreCollectionDocuments(connectionInstanceId: string, namespace: string, currentDocLimit: number): Thenable<void> {
    if (!this._connectionController) {
      return Promise.reject('No connection controller');
    }

    const connectionIdUriQuery = `${CONNECTION_ID_URI_IDENTIFIER}=${connectionInstanceId}`;
    const newDocLimit = DOCUMENTS_LIMIT + currentDocLimit;
    const docLimitUriQuery = `${DOC_LIMIT_URI_IDENTIFIER}=${newDocLimit}`;
    const namespaceUriQuery = `${NAMESPACE_URI_IDENTIFIER}=${namespace}`;
    const uriQuery = `?${namespaceUriQuery}&${connectionIdUriQuery}&${docLimitUriQuery}`;
    // We attach the current time to ensure a new editor window is opened on
    // each query and maybe help the user know when the query started.
    // The part of the URI after the scheme and before the query is the file name.
    const uri = vscode.Uri.parse( //  ${Date.now()}
      `${VIEW_COLLECTION_SCHEME}:Results: ${namespace}.json${uriQuery}`
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
}
