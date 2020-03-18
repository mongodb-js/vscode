import { URLSearchParams } from 'url';
import * as vscode from 'vscode';
import { EJSON } from 'bson';

import ConnectionController from '../connectionController';
import { StatusView } from '../views';
import { CONNECTION_ID_URI_IDENTIFIER, NAMESPACE_URI_IDENTIFIER } from './collectionDocumentsProvider';

export const DOCUMENT_ID_URI_IDENTIFIER = 'documentId';

export const VIEW_DOCUMENT_SCHEME = 'VIEW_DOCUMENT_SCHEME';

export default class DocumentViewProvider implements vscode.TextDocumentContentProvider {
  _connectionController: ConnectionController;
  _statusView: StatusView;

  constructor(
    connectionController: ConnectionController,
    statusView: StatusView
  ) {
    this._connectionController = connectionController;
    this._statusView = statusView;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return new Promise((resolve, reject) => {
      const uriParams = new URLSearchParams(uri.query);
      const namespace = String(uriParams.get(NAMESPACE_URI_IDENTIFIER));
      const connectionId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
      const documentIdEJSONString = decodeURIComponent(uriParams.get(DOCUMENT_ID_URI_IDENTIFIER) || '');
      const documentId = EJSON.parse(documentIdEJSONString).value;

      // Ensure we're still connected to the correct connection.
      if (
        connectionId !==
        this._connectionController.getActiveConnectionId()
      ) {
        vscode.window.showErrorMessage(
          `Unable to list documents: no longer connected to ${connectionId}`
        );
        return reject(
          new Error(
            `Unable to list documents: no longer connected to ${connectionId}`
          )
        );
      }

      this._statusView.showMessage('Fetching document...');

      const dataservice = this._connectionController.getActiveDataService();
      if (dataservice === null) {
        vscode.window.showErrorMessage(
          `Unable to find document: no longer connected to ${connectionId}`
        );
        return reject(
          new Error(
            `Unable to find document: no longer connected to ${connectionId}`
          )
        );
      }

      dataservice.find(
        namespace,
        {
          _id: documentId
        },
        {
          limit: 1
        },
        (err: Error | undefined, documents: object[]) => {
          this._statusView.hideMessage();

          if (err) {
            vscode.window.showErrorMessage(
              `Unable to find document: ${err.message}`
            );
            return reject(
              new Error(`Unable to find document: ${err.message}`)
            );
          }

          if (!documents || documents.length === 0) {
            vscode.window.showErrorMessage(
              `Unable to find document: ${documentId}`
            );
            return reject(
              new Error(`Unable to find document: ${documentId}`)
            );
          }

          return resolve(EJSON.stringify(documents[0], null, 2));
        }
      );
    });
  }
}
