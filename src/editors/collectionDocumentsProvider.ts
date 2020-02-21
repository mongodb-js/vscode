import * as vscode from 'vscode';

import ConnectionController from '../connectionController';

export const NAMESPACE_URI_IDENTIFIER = 'namespace';
export const VIEW_COLLECTION_SCHEME = 'VIEW_COLLECTION_SCHEME';
export const DOCUMENTS_LIMIT = 10;

export default class CollectionViewProvider implements vscode.TextDocumentContentProvider {
  _connectionController: ConnectionController;

  constructor(connectionController: ConnectionController) {
    this._connectionController = connectionController;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return new Promise(resolve => {
      const dataservice = this._connectionController.getActiveConnection();

      // Remove the `namespace=` attribute from the uri query.
      const namespace = uri.query.slice(NAMESPACE_URI_IDENTIFIER.length + 1);
      dataservice.find(
        namespace,
        {}, // No filter.
        {
          limit: DOCUMENTS_LIMIT
        },
        (err: Error, documents: []) => {
          if (err) {
            vscode.window.showErrorMessage(`Unable to list documents: ${err}`);
            return resolve(`Unable to list documents: ${err}`);
          }

          return resolve(JSON.stringify(documents, null, 2));
        }
      );
    });
  }
}
