import * as vscode from 'vscode';
import EXTENSION_COMMANDS from '../commands';
import PlaygroundController from './playgroundController';

export default class CodeActionProvider implements vscode.CodeActionProvider {
  _playgroundController: PlaygroundController;

  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(playgroundController: PlaygroundController) {
    this._playgroundController = playgroundController;
  }

  provideCodeActions(): vscode.CodeAction[] | undefined {
    if (!this._playgroundController._selectedText) {
      return;
    }

    const commandAction = new vscode.CodeAction('Run selected playground blocks', vscode.CodeActionKind.Empty);

    commandAction.command = {
      command: EXTENSION_COMMANDS.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
      title: 'Run selected playground blocks',
      tooltip: 'Run selected playground blocks'
    };

    return [commandAction];
  }
}
