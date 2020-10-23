import * as vscode from 'vscode';
import { StatusView } from '../views';
import PlaygroundController, { PlaygroundEventTypes } from './playgroundController';

export const PLAYGROUND_RESULT_SCHEME = 'PLAYGROUND_RESULT_SCHEME';

export default class PlaygroundResultProvider implements vscode.TextDocumentContentProvider {
  _playgroundController: PlaygroundController;
  _statusView: StatusView;

  constructor(
    playgroundController: PlaygroundController,
    statusView: StatusView
  ) {
    this._playgroundController = playgroundController;
    this._statusView = statusView;

    this._playgroundController.addEventListener(
      PlaygroundEventTypes.PLAYGROUND_RESULT_CHANGED,
      () => this.provideTextDocumentContent()
    );
  }

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  provideTextDocumentContent(): Promise<string> {
    console.log('----------------------');
    console.log(777);
    console.log('----------------------');

    return new Promise((resolve, reject) => {
      this._statusView.showMessage('Getting results...');

      return resolve(JSON.stringify(this._playgroundController.playgroundResult, null, 2));
    });
  }
}
