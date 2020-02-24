import { URLSearchParams } from 'url';
import * as vscode from 'vscode';
import { EJSON } from 'bson';

import ConnectionController from '../connectionController';

export const DOC_LIMIT_URI_IDENTIFIER = 'documentLimit';
export const NAMESPACE_URI_IDENTIFIER = 'namespace';
export const CONNECTION_ID_URI_IDENTIFIER = 'connectionId';

export const DOCUMENTS_LIMIT = 10;

export const VIEW_COLLECTION_SCHEME = 'VIEW_COLLECTION_SCHEME';

export default class CollectionViewProvider implements vscode.TextDocumentContentProvider {
  _connectionController: ConnectionController;
  _activeCursors: {
    [key: string]: any;
  } = {};

  constructor(connectionController: ConnectionController) {
    this._connectionController = connectionController;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  // createNewCursor() {

  // }

  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return new Promise((resolve, reject) => {
      const uriParams = new URLSearchParams(uri.query);
      const namespace = String(uriParams.get(NAMESPACE_URI_IDENTIFIER));
      const amountOfDocs = Number(uriParams.get(DOC_LIMIT_URI_IDENTIFIER));
      const connectionInstanceId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);

      // Ensure we're still connected to the correction connection.
      if (connectionInstanceId !== this._connectionController.getActiveConnectionInstanceId()) {
        vscode.window.showErrorMessage(`Unable to list documents: no longer connected to ${connectionInstanceId}`);
        return reject(`Unable to list documents: no longer connected to ${connectionInstanceId}`);
      }

      // TODO: Real active cursor ids.
      // TODO: Does the cursor hold over if they reconnect.
      // if (this._activeCursors[namespace]) {
      //   // consople
      //   // this._activeCursors[namespace].limit(amountOfDocs)
      //   this._activeCursors[namespace].limit(amountOfDocs).toArray((err: Error, documents: []) => {
      //     if (err) {
      //       vscode.window.showErrorMessage(`Unable to list documents: ${err}`);
      //       return reject(`Unable to list documents: ${err}`);
      //     }

      //     return resolve(EJSON.stringify(documents, null, 2));
      //   });
      // } else {
      //   // Create a new cursor.
      //   const dataservice = this._connectionController.getActiveConnection();
      //   const queryCursor = dataservice.fetch(
      //     namespace,
      //     {}, // No filter.
      //     {
      //       batchSize: 10
      //       // limit: 10
      //     } // No options.
      //   );

      //   console.log('cursor:', queryCursor);
      //   console.log('cursor methods', Object.keys(queryCursor));

      //   this._activeCursors[namespace] = queryCursor;

      //   queryCursor.next((err: Error, documents: []) => {
      //     console.log('in next', documents);
      //     if (err) {
      //       vscode.window.showErrorMessage(`Unable to list documents: ${err}`);
      //       return reject(`Unable to list documents: ${err}`);
      //     }

      //     return resolve(EJSON.stringify(documents, null, 2));
      //   });

      //   // this._activeCursors[namespace] = queryCursor;

      //   // queryCursor.limit(amountOfDocs).toArray((err: Error, documents: []) => {
      //   //   if (err) {
      //   //     vscode.window.showErrorMessage(`Unable to list documents: ${err}`);
      //   //     return reject(`Unable to list documents: ${err}`);
      //   //   }

      //   //   return resolve(EJSON.stringify(documents, null, 2));
      //   // });
      // }

      const dataservice = this._connectionController.getActiveConnection();
      dataservice.find(
        namespace,
        {}, // No filter.
        {
          limit: amountOfDocs
        },
        (err: Error, documents: []) => {
          if (err) {
            vscode.window.showErrorMessage(`Unable to list documents: ${err}`);
            return reject(`Unable to list documents: ${err}`);
          }

          return resolve(EJSON.stringify(documents, null, 2));
        }
      );
    });
  }
}
