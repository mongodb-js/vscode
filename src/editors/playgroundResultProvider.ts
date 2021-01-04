import * as vscode from 'vscode';
import EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import type { OutputItem, DocCodeLensesInfo } from '../utils/types';

export const PLAYGROUND_RESULT_SCHEME = 'PLAYGROUND_RESULT_SCHEME';

export default class PlaygroundResultProvider
  implements vscode.TextDocumentContentProvider {
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  _playgroundResult: OutputItem;
  _uri?: vscode.Uri;

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

  refreshPlaygroundResult(playgroundResult?: OutputItem): void {
    if (playgroundResult) {
      this._playgroundResult = playgroundResult;
    }
  }

  refreshPlaygroundResultContent(data?: any): void {
    if (
      this._playgroundResult.content &&
      Array.isArray(this._playgroundResult.content)
    ) {
      const content = [...this._playgroundResult.content];
      const index = content.findIndex((item) => item._id === data._id);

      Object.keys(content[index]).forEach((item) => {
        if (this._playgroundResult && this._playgroundResult.content) {
          this._playgroundResult.content[index][item] = data[item];
        }
      });
    } else if (
      this._playgroundResult !== null &&
      typeof this._playgroundResult === 'object'
    ) {
      const content = { ...this._playgroundResult.content };

      Object.keys(content).forEach((item) => {
        if (this._playgroundResult && this._playgroundResult.content) {
          this._playgroundResult.content[item] = data[item];
        }
      });
    }

    if (this._uri) {
      this.onDidChangeEmitter.fire(this._uri);
    }
  }

  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    this._uri = uri;

    return new Promise((resolve) => {
      const namespace: string | null = this._playgroundResult.namespace;
      const type: string | null = this._playgroundResult.type;
      const content = this._playgroundResult.content;

      if (!content) {
        return resolve('');
      }

      if (typeof content !== 'object' || type === 'string') {
        return resolve(this._playgroundResult.content);
      }

      const codeLensesInfo: DocCodeLensesInfo = [];

      if (type === 'Cursor' && Array.isArray(content)) {
        let line = 2;

        content.forEach((item) => {
          if (item._id && namespace) {
            codeLensesInfo.push({ line, documentId: item._id, namespace });
            line += JSON.stringify(item, null, 2).split(/\r\n|\r|\n/).length;
          }
        });
      } else if (type === 'Document' && content._id && namespace) {
        codeLensesInfo.push({ line: 0, documentId: content._id, namespace });
      }

      this._editDocumentCodeLensProvider?.refresh(codeLensesInfo);

      return resolve(JSON.stringify(content, null, 2));
    });
  }
}
