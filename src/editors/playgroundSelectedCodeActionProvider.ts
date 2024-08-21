import * as vscode from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import { isPlayground } from '../utils/playground';

export default class PlaygroundSelectedCodeActionProvider
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

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): vscode.CodeAction[] | undefined {
    if (!range || range.isEmpty || !isPlayground(document.uri)) {
      return;
    }

    const codeActions: vscode.CodeAction[] = [];
    const runSelectedPlaygroundBlockCommand = new vscode.CodeAction(
      'Run selected playground blocks',
      vscode.CodeActionKind.Empty
    );
    runSelectedPlaygroundBlockCommand.command = {
      command: EXTENSION_COMMANDS.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
      title: 'Run selected playground blocks',
      tooltip: 'Run selected playground blocks',
    };
    codeActions.push(runSelectedPlaygroundBlockCommand);

    return codeActions;
  }
}
