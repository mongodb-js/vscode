import * as vscode from 'vscode';

import ExtensionCommand from '../commands';
import { isPlayground, getSelectedText } from '../utils/playground';

export default class PlaygroundSelectionCodeActionProvider
  implements vscode.CodeActionProvider
{
  _onDidChangeCodeCodeAction: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();

  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeCodeAction.fire();
    });
  }

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeCodeAction.event;

  createCodeAction(command: vscode.Command): vscode.CodeAction {
    const codeAction = new vscode.CodeAction(
      command.title,
      vscode.CodeActionKind.Empty,
    );
    codeAction.command = command;
    return codeAction;
  }

  provideCodeActions(): vscode.CodeAction[] | undefined {
    const editor = vscode.window.activeTextEditor;

    if (!isPlayground(editor?.document.uri) || !getSelectedText()) {
      return;
    }

    const codeActions: vscode.CodeAction[] = [
      this.createCodeAction({
        title: 'Run selected playground blocks',
        command: ExtensionCommand.mdbRunSelectedPlaygroundBlocks,
      }),
    ];

    return codeActions;
  }
}
