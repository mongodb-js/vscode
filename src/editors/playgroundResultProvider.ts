import * as vscode from 'vscode';
import EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import type { OutputItem } from '../utils/types';

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
    const type = this._playgroundResult.type;
    const content = this._playgroundResult.content;

    if (type === 'undefined') {
      return 'undefined';
    }

    if (type === 'string') {
      return this._playgroundResult.content;
    }

    this._editDocumentCodeLensProvider?.updateCodeLensesPosition(
      this._playgroundResult
    );

    return JSON.stringify(content, null, 2);
  }
}
