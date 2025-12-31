import { URLSearchParams } from 'url';
import * as vscode from 'vscode';
import ExtensionCommand from '../commands';

import type CollectionDocumentsOperationStore from './collectionDocumentsOperationsStore';
import {
  CONNECTION_ID_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER,
  OPERATION_ID_URI_IDENTIFIER,
} from './collectionDocumentsProvider';

export default class CollectionDocumentsCodeLensProvider
  implements vscode.CodeLensProvider
{
  _codeLenses: vscode.CodeLens[] = [];
  _activeOperationsStore: CollectionDocumentsOperationStore;
  _uri: vscode.Uri = vscode.Uri.parse('');
  _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(operationsStore: CollectionDocumentsOperationStore) {
    this._activeOperationsStore = operationsStore;

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const uriParams = new URLSearchParams(document.uri.query);
    const operationId = uriParams.get(OPERATION_ID_URI_IDENTIFIER);

    if (!operationId) {
      return [];
    }

    if (
      !this._activeOperationsStore.operations[operationId]
        .hasMoreDocumentsToShow
    ) {
      return [];
    }

    // Create a codelens at the second to last line. This should be before
    // the closing ']'.
    this._codeLenses = [
      new vscode.CodeLens(
        new vscode.Range(
          new vscode.Position(document.lineCount - 1, 0),
          new vscode.Position(document.lineCount, 0),
        ),
      ),
    ];

    this._uri = document.uri;

    return this._codeLenses;
  }

  resolveCodeLens?(codeLens: vscode.CodeLens): vscode.CodeLens {
    const uriParams = new URLSearchParams(this._uri.query);
    const namespace = uriParams.get(NAMESPACE_URI_IDENTIFIER);
    const connectionId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
    const operationId = uriParams.get(OPERATION_ID_URI_IDENTIFIER);

    if (!operationId) {
      return codeLens;
    }

    const operation = this._activeOperationsStore.operations[operationId];
    const amountOfDocs = operation.currentLimit;

    let commandTitle;
    let commandTooltip;

    if (operation.isCurrentlyFetchingMoreDocuments) {
      commandTitle = `... Fetching ${amountOfDocs} documents...`;
      commandTooltip =
        'Currently fetching more documents. The amount of documents fetched can be adjusted in the extension settings.';
    } else {
      const additionalDocumentsToFetch = vscode.workspace
        .getConfiguration('mdb')
        .get('defaultLimit');

      if (
        typeof additionalDocumentsToFetch !== 'number' &&
        typeof additionalDocumentsToFetch !== 'string'
      ) {
        throw new Error(
          'Could not retrieve the defaultLimit setting from the extension settings.',
        );
      }

      commandTitle = `... Showing ${amountOfDocs} documents. Click to open ${additionalDocumentsToFetch} more documents.`;
      commandTooltip = `Click to open ${additionalDocumentsToFetch} more documents, this amount can be changed in the extension settings.`;
    }

    codeLens.command = {
      title: commandTitle,
      tooltip: commandTooltip,
      command: ExtensionCommand.mdbCodelensShowMoreDocuments,
      arguments: [{ operationId, connectionId, namespace }],
    };

    return codeLens;
  }
}
