import * as vscode from 'vscode';
import { URLSearchParams } from 'url';
import { toJSString } from 'mongodb-query-parser';

import type CollectionDocumentsOperationsStore from './collectionDocumentsOperationsStore';
import type ConnectionController from '../connectionController';
import type EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import formatError from '../utils/formatError';
import type { StatusView } from '../views';
import { DOCUMENT_FORMAT_URI_IDENTIFIER } from './mongoDBDocumentService';
import { EJSON } from 'bson';

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

  constructor({
    context,
    connectionController,
    operationsStore,
    statusView,
    editDocumentCodeLensProvider,
  }: {
    context: vscode.ExtensionContext;
    connectionController: ConnectionController;
    operationsStore: CollectionDocumentsOperationsStore;
    statusView: StatusView;
    editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  }) {
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
    const editFormat =
      uriParams.get(DOCUMENT_FORMAT_URI_IDENTIFIER) === 'ejson'
        ? 'ejson'
        : 'shell';

    if (!operationId) {
      void vscode.window.showErrorMessage(
        'Unable to list documents: invalid operation',
      );

      throw new Error('Unable to list documents: invalid operation');
    }

    const operation = this._operationsStore.operations[operationId];
    const documentLimit = operation.currentLimit;

    // Ensure we're still connected to the correct connection.
    if (connectionId !== this._connectionController.getActiveConnectionId()) {
      operation.isCurrentlyFetchingMoreDocuments = false;
      const oldConnectionName =
        this._connectionController.getSavedConnectionName(connectionId || '') ||
        'the database';
      void vscode.window.showErrorMessage(
        `Unable to list documents: no longer connected to ${oldConnectionName}`,
      );

      throw new Error(
        `Unable to list documents: no longer connected to ${oldConnectionName}`,
      );
    }

    this._statusView.showMessage('Fetching documents...');

    const dataservice = this._connectionController.getActiveDataService();

    if (dataservice === null) {
      const errorMessage = 'Unable to list documents: no longer connected';

      void vscode.window.showErrorMessage(errorMessage);

      throw new Error(errorMessage);
    }

    try {
      const documents = await dataservice.find(
        namespace,
        {}, // No filter.
        {
          limit: documentLimit,
          promoteValues: false,
        },
      );

      operation.isCurrentlyFetchingMoreDocuments = false;
      this._statusView.hideMessage();

      if (documents.length !== documentLimit) {
        operation.hasMoreDocumentsToShow = false;
      }

      this._editDocumentCodeLensProvider.updateCodeLensesForCollection({
        content: documents,
        namespace,
        format: editFormat,
        uri,
      });

      if (editFormat === 'shell') {
        return toJSString(documents, 2) ?? '';
      }

      return EJSON.stringify(documents, undefined, 2, { relaxed: false });
    } catch (error) {
      const errorMessage = `Unable to list documents: ${
        formatError(error).message
      }`;

      void vscode.window.showErrorMessage(errorMessage);

      throw Error(errorMessage);
    }
  }
}
