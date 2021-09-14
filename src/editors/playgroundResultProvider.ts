import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import type { PlaygroundResult } from '../types/playgroundType';

export const PLAYGROUND_RESULT_SCHEME = 'PLAYGROUND_RESULT_SCHEME';

export const PLAYGROUND_RESULT_URI = vscode.Uri.parse(
  `${PLAYGROUND_RESULT_SCHEME}:/Playground Result`
);

export default class PlaygroundResultProvider
implements vscode.TextDocumentContentProvider {
  _connectionController: ConnectionController;
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  _playgroundResult: PlaygroundResult;

  constructor(
    connectionController: ConnectionController,
    editDocumentCodeLensProvider: EditDocumentCodeLensProvider
  ) {
    this._connectionController = connectionController;
    this._editDocumentCodeLensProvider = editDocumentCodeLensProvider;
    this._playgroundResult = {
      namespace: null,
      type: null,
      content: undefined
    };
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  setPlaygroundResult(playgroundResult?: PlaygroundResult): void {
    if (playgroundResult) {
      this._playgroundResult = playgroundResult;
    }
  }

  refresh(): void {
    this.onDidChangeEmitter.fire(PLAYGROUND_RESULT_URI);
  }

  provideTextDocumentContent(): string {
    if (!this._playgroundResult) {
      return 'undefined';
    }

    const { type, content } = this._playgroundResult;

    if (type === 'undefined') {
      return 'undefined';
    }

    if (
      type === 'string' ||
      type === 'python' ||
      type === 'java' ||
      type === 'csharp' ||
      type === 'javascript'
    ) {
      return this._playgroundResult.content;
    }

    this._editDocumentCodeLensProvider?.updateCodeLensesForPlayground(
      this._playgroundResult
    );

    return JSON.stringify(content, null, 2);
  }
}
