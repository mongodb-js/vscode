import * as vscode from 'vscode';
import { StatusView } from '../views';
import PlaygroundController from './playgroundController';

export const PLAYGROUND_RESULT_SCHEME = 'PLAYGROUND_RESULT_SCHEME';

export default class PlaygroundResultProvider
  implements vscode.TextDocumentContentProvider {
  _playgroundController: PlaygroundController;
  _statusView: StatusView;

  constructor(
    playgroundController: PlaygroundController,
    statusView: StatusView
  ) {
    this._playgroundController = playgroundController;
    this._statusView = statusView;
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(): Promise<string> {
    return new Promise((resolve) => {
      this._statusView.showMessage('Getting results...');

      if (
        typeof this._playgroundController.playgroundResult?.content ===
          'object' ||
        this._playgroundController.playgroundResult?.type !== 'string'
      ) {
        return resolve(
          JSON.stringify(
            this._playgroundController.playgroundResult?.content,
            null,
            2
          )
        );
      }

      return resolve(this._playgroundController.playgroundResult?.content);
    });
  }
}
