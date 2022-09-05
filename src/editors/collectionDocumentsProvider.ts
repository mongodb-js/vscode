import * as vscode from 'vscode';
import * as util from 'util';
import { URLSearchParams } from 'url';

import CollectionDocumentsOperationsStore from './collectionDocumentsOperationsStore';
import ConnectionController from '../connectionController';
import EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import formatError from '../utils/formatError';
import { StatusView } from '../views';

export const NAMESPACE_URI_IDENTIFIER = 'namespace';
export const OPERATION_ID_URI_IDENTIFIER = 'operationId';
export const CONNECTION_ID_URI_IDENTIFIER = 'connectionId';

export const VIEW_COLLECTION_SCHEME = 'VIEW_COLLECTION_SCHEME';

export default class CollectionViewProvider
  implements vscode.TextDocumentContentProvider
{
  _context: vscode.ExtensionContext;
  _connectionController: ConnectionController;
  _operationsStore: CollectionDocumentsOperationsStore;
  _statusView: StatusView;
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    operationsStore: CollectionDocumentsOperationsStore,
    statusView: StatusView,
    editDocumentCodeLensProvider: EditDocumentCodeLensProvider
  ) {
    this._context = context;
    this._connectionController = connectionController;
    this._operationsStore = operationsStore;
    this._statusView = statusView;
    this._editDocumentCodeLensProvider = editDocumentCodeLensProvider;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const uriParams = new URLSearchParams(uri.query);
    const namespace = String(uriParams.get(NAMESPACE_URI_IDENTIFIER));
    const connectionId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
    const operationId = uriParams.get(OPERATION_ID_URI_IDENTIFIER);

    if (!operationId) {
      void vscode.window.showErrorMessage(
        'Unable to list documents: invalid operation'
      );

      throw new Error('Unable to list documents: invalid operation');
    }

    const operation = this._operationsStore.operations[operationId];
    const documentLimit = operation.currentLimit;

    // Ensure we're still connected to the correct connection.
    if (connectionId !== this._connectionController.getActiveConnectionId()) {
      operation.isCurrentlyFetchingMoreDocuments = false;
      void vscode.window.showErrorMessage(
        `Unable to list documents: no longer connected to ${connectionId}`
      );

      throw new Error(
        `Unable to list documents: no longer connected to ${connectionId}`
      );
    }

    this._statusView.showMessage('Fetching documents...');

    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      const errorMessage = `Unable to list documents: no longer connected to ${connectionId}`;

      void vscode.window.showErrorMessage(errorMessage);

      throw new Error(errorMessage);
    }

    try {
      const find = util.promisify(dataservice.find.bind(dataservice));
      const documents = await find(
        namespace,
        {}, // No filter.
        { limit: documentLimit }
      );

      operation.isCurrentlyFetchingMoreDocuments = false;
      this._statusView.hideMessage();

      if (documents.length !== documentLimit) {
        operation.hasMoreDocumentsToShow = false;
      }

      this._editDocumentCodeLensProvider.updateCodeLensesForCollection({
        content: documents,
        namespace,
        uri,
      });

      return JSON.stringify(documents, null, 2);
    } catch (error) {
      const errorMessage = `Unable to list documents: ${
        formatError(error).message
      }`;

      void vscode.window.showErrorMessage(errorMessage);

      throw Error(errorMessage);
    }
  }
}
