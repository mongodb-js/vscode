import * as vscode from 'vscode';

import type ConnectionController from '../connectionController';
import type EditDocumentCodeLensProvider from './editDocumentCodeLensProvider';
import {
  type PlaygroundRunResult,
  type ExportToLanguageResult,
} from '../types/playgroundType';
import { isExportToLanguageResult } from '../types/playgroundType';
import { toJSString } from 'mongodb-query-parser';

export const PLAYGROUND_RESULT_SCHEME = 'PLAYGROUND_RESULT_SCHEME';

export const PLAYGROUND_RESULT_URI = vscode.Uri.parse(
  `${PLAYGROUND_RESULT_SCHEME}:/Playground Result`
);

export default class PlaygroundResultProvider
  implements vscode.TextDocumentContentProvider
{
  _connectionController: ConnectionController;
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  _playgroundResult?: PlaygroundRunResult | ExportToLanguageResult;

  constructor(
    connectionController: ConnectionController,
    editDocumentCodeLensProvider: EditDocumentCodeLensProvider
  ) {
    this._connectionController = connectionController;
    this._editDocumentCodeLensProvider = editDocumentCodeLensProvider;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  setPlaygroundResult(
    playgroundResult?: PlaygroundRunResult | ExportToLanguageResult
  ): void {
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

    if (
      isExportToLanguageResult(this._playgroundResult) ||
      this._playgroundResult.type === 'string'
    ) {
      return this._playgroundResult.content;
    }

    if (this._playgroundResult.type === 'undefined') {
      return 'undefined';
    }

    // TODO: Possible bug that this update code lenses happens after the content is returned sometimes?
    this._editDocumentCodeLensProvider?.updateCodeLensesForPlayground(
      this._playgroundResult
    );

    if (this._playgroundResult.type === 'javascript') {
      return toJSString(this._playgroundResult.content, 2) ?? '';
    }

    return JSON.stringify(this._playgroundResult.content, null, 2);
  }
}
