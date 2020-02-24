import { EJSON } from 'bson';
import { URLSearchParams } from 'url';
import * as vscode from 'vscode';
import {
  DOCUMENTS_LIMIT,
  CONNECTION_ID_URI_IDENTIFIER,
  DOC_LIMIT_URI_IDENTIFIER,
  NAMESPACE_URI_IDENTIFIER
} from './collectionDocumentsProvider';

export default class CollectionDocumentsCodeLensProvider implements vscode.CodeLensProvider {
  private _codeLenses: vscode.CodeLens[] = [];
  private uri: vscode.Uri = vscode.Uri.parse('');
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const documentsArray = document.getText();
    const docJson = EJSON.parse(documentsArray);

    const uriParams = new URLSearchParams(document.uri.query);
    const amountOfDocs = Number(uriParams.get(DOC_LIMIT_URI_IDENTIFIER));

    // If we aren't showing the max amount of documents it means there aren't
    // more to show.
    if (docJson.length < amountOfDocs) {
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
  ): vscode.CodeLens | Thenable<vscode.CodeLens> {
    const uriParams = new URLSearchParams(this.uri.query);
    const namespace = uriParams.get(NAMESPACE_URI_IDENTIFIER);
    // Increase the amount of documents to show by DOCUMENTS_LIMIT.
    const amountOfDocuments = Number(uriParams.get(DOC_LIMIT_URI_IDENTIFIER));
    const connectionInstanceId = uriParams.get(CONNECTION_ID_URI_IDENTIFIER);

    codeLens.command = {
      title: `... Showing the first ${amountOfDocuments} documents. Click to show ${DOCUMENTS_LIMIT} more documents.`,
      tooltip: `Click to show ${DOCUMENTS_LIMIT} more documents`,
      command: 'mdb.codelens.showMoreDocumentsClicked',
      arguments: [connectionInstanceId, namespace, amountOfDocuments]
    };
    return codeLens;
  }
}
