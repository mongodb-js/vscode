import * as vscode from 'vscode';
import EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import type { OutputItem, DocCodeLensesInfo } from '../utils/types';

export const PLAYGROUND_RESULT_SCHEME = 'PLAYGROUND_RESULT_SCHEME';

export const PLAYGROUND_RESULT_URI = vscode.Uri.parse(
  `${PLAYGROUND_RESULT_SCHEME}:Playground Result`
);

export default class PlaygroundResultProvider
  implements vscode.TextDocumentContentProvider {
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  _playgroundResult: OutputItem;

  constructor(context: vscode.ExtensionContext) {
    this._editDocumentCodeLensProvider = new EditDocumentCodeLensProvider();
    this._playgroundResult = {
      namespace: null,
      type: null,
      content: undefined
    };

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

  setPlaygroundResult(playgroundResult?: OutputItem): void {
    if (playgroundResult) {
      this._playgroundResult = playgroundResult;
    }
  }

  async refresh(): Promise<void> {
    this.onDidChangeEmitter.fire(PLAYGROUND_RESULT_URI);
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
