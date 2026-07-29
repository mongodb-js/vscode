import * as vscode from 'vscode';
import { toJSString } from 'mongodb-query-parser';
import { EJSON } from 'bson';

import type ConnectionController from '../connectionController';
import type EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import { type PlaygroundRunResult } from '../types/playgroundType';

export const PLAYGROUND_RESULT_SCHEME = 'PLAYGROUND_RESULT_SCHEME';

export const PLAYGROUND_RESULT_URI = vscode.Uri.parse(
  `${PLAYGROUND_RESULT_SCHEME}:/Playground Result`,
);

export default class PlaygroundResultProvider
  implements vscode.TextDocumentContentProvider
{
  _connectionController: ConnectionController;
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  _playgroundResult?: PlaygroundRunResult;

  constructor(
    connectionController: ConnectionController,
    editDocumentCodeLensProvider: EditDocumentCodeLensProvider,
  ) {
    this._connectionController = connectionController;
    this._editDocumentCodeLensProvider = editDocumentCodeLensProvider;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  setPlaygroundResult(playgroundResult?: PlaygroundRunResult): void {
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

    if (this._playgroundResult.type === 'undefined') {
      return 'undefined';
    }

    this._editDocumentCodeLensProvider?.updateCodeLensesForPlayground(
      this._playgroundResult,
    );

    if (this._playgroundResult.language === 'shell') {
      return (
        toJSString(
          EJSON.deserialize(this._playgroundResult.content, { relaxed: false }),
          2,
        ) ?? ''
      );
    }

    return JSON.stringify(this._playgroundResult.content, null, 2);
  }
}
