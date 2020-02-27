import { URLSearchParams } from 'url';
import * as vscode from 'vscode';

import CollectionDocumentsOperationStore from './collectionDocumentsOperationsStore';
import {
  CONNECTION_ID_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER,
  OPERATION_ID_URI_IDENTIFIER
} from './collectionDocumentsProvider';

export default class CollectionDocumentsCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
  private _activeOperationsStore: CollectionDocumentsOperationStore;
  private uri: vscode.Uri = vscode.Uri.parse('');
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor(operationsStore: CollectionDocumentsOperationStore) {
    this._activeOperationsStore = operationsStore;

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument
  ): vscode.CodeLens[] {
    const uriParams = new URLSearchParams(document.uri.query);
    const operationId = uriParams.get(OPERATION_ID_URI_IDENTIFIER);
    if (!operationId) {
      return [];
    }

    if (!this._activeOperationsStore.operations[operationId].hasMoreDocumentsToShow) {
      return [];
    }

    // Create a codelens at the second to last line. This should be before
    // the closing ']'.
    this._codeLenses = [new vscode.CodeLens(new vscode.Range(
      new vscode.Position(
        document.lineCount - 1, 0
      ),
      new vscode.Position(
        document.lineCount, 0
      ),
    ))];

    this.uri = document.uri;

    return this._codeLenses;
  }

  public resolveCodeLens?(
    codeLens: vscode.CodeLens
  ): vscode.CodeLens {
    const uriParams = new URLSearchParams(this.uri.query);

    const namespace = uriParams.get(NAMESPACE_URI_IDENTIFIER);
    const connectionInstanceId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);
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
      commandTooltip = 'Currently fetching more documents. The amount of documents fetched can be adjusted in the extension settings.';
    } else {
      const additionalDocumentsToFetch = vscode.workspace.getConfiguration(
        'mdb'
      ).get('defaultLimit');

      commandTitle = `... Showing ${amountOfDocs} documents. Click to open ${additionalDocumentsToFetch} more documents.`;
      commandTooltip = `Click to open ${additionalDocumentsToFetch} more documents, this amount can be changed in the extension settings.`;
    }

    codeLens.command = {
      title: commandTitle,
      tooltip: commandTooltip,
      command: 'mdb.codeLens.showMoreDocumentsClicked',
      arguments: [operationId, connectionInstanceId, namespace]
    };

    return codeLens;
  }
}
