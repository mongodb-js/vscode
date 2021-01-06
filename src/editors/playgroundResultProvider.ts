import * as vscode from 'vscode';
import EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import type { OutputItem, DocCodeLensesInfo } from '../utils/types';

export const PLAYGROUND_RESULT_SCHEME = 'PLAYGROUND_RESULT_SCHEME';

export default class PlaygroundResultProvider
  implements vscode.TextDocumentContentProvider {
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  _playgroundResult: OutputItem;
  _uri: vscode.Uri;

  constructor(context: vscode.ExtensionContext) {
    this._editDocumentCodeLensProvider = new EditDocumentCodeLensProvider();
    this._playgroundResult = {
      namespace: null,
      type: null,
      content: undefined
    };
    this._uri = vscode.Uri.parse('');

    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        {
          scheme: PLAYGROUND_RESULT_SCHEME,
          language: 'json'
        },
        this._editDocumentCodeLensProvider
      )
    );
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  setPlaygroundResultUri(uri: vscode.Uri) {
    this._uri = uri;
  }

  // When the playground evaluation response is received,
  // use playgroundResult (namespace, type, content)
  // to provide a virtual document content.
  refreshPlaygroundResult(playgroundResult?: OutputItem): void {
    if (playgroundResult) {
      this._playgroundResult = playgroundResult;
    }
  }

  // When the document is saved (Cmd/Ctrl + S or with the menu),
  // update the document (content) in the collection
  // or the single document to reflect the changes that were made.
  refreshPlaygroundResultContent(document?: any): void {
    if (
      this._playgroundResult.content &&
      Array.isArray(this._playgroundResult.content)
    ) {
      const content = [...this._playgroundResult.content];
      const index = content.findIndex((item) => item._id === document._id);

      if (typeof content[index] === 'object' && content[index] !== null) {
        Object.keys(content[index]).forEach((item) => {
          if (this._playgroundResult && this._playgroundResult.content) {
            this._playgroundResult.content[index][item] = document[item];
          }
        });
      }
    } else if (
      this._playgroundResult.content !== null &&
      typeof this._playgroundResult.content === 'object'
    ) {
      const content = { ...this._playgroundResult.content };

      Object.keys(content).forEach((item) => {
        if (this._playgroundResult && this._playgroundResult.content) {
          this._playgroundResult.content[item] = document[item];
        }
      });
    }

    this.onDidChangeEmitter.fire(this._uri);
  }

  async reopenResultAsVirtualDocument(
    viewColumn: vscode.ViewColumn,
    playgroundResult?: OutputItem
  ): Promise<void> {
    if (playgroundResult) {
      this._playgroundResult = playgroundResult;
    }

    this.onDidChangeEmitter.fire(this._uri);
    await vscode.window.showTextDocument(this._uri, {
      preview: false,
      viewColumn
    });
  }

  provideTextDocumentContent(): string {
    const namespace: string | null = this._playgroundResult.namespace;
    const type: string | null = this._playgroundResult.type;
    const content: any = this._playgroundResult.content;

    if (type === 'undefined') {
      return 'undefined';
    }

    if (type === 'string') {
      return this._playgroundResult.content;
    }

    const codeLensesInfo: DocCodeLensesInfo = [];

    // Show code lenses only for the list of documents returned by `find()`
    // or the single document returned by `findOne()`.
    if (type === 'Cursor' && Array.isArray(content)) {
      // When the playground result is the collection,
      // show the first code lense after [{.
      let line = 2;

      content.forEach((item) => {
        // We need _id and namespace for code lenses
        // to be able to save the editable document.
        if (item._id && namespace) {
          codeLensesInfo.push({ line, documentId: item._id, namespace });
          // To calculate the position of the next open curly bracket,
          // we stringify the object and use a regular expression
          // so we can count the number of lines.
          line += JSON.stringify(item, null, 2).split(/\r\n|\r|\n/).length;
        }
      });
    } else if (type === 'Document' && content._id && namespace) {
      // When the playground result is the single document,
      // show the single code lense after {.
      codeLensesInfo.push({ line: 1, documentId: content._id, namespace });
    }

    this._editDocumentCodeLensProvider?.refresh(codeLensesInfo);

    return JSON.stringify(content, null, 2);
  }
}
