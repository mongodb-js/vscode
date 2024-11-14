import * as vscode from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import { isPlayground, getSelectedText } from '../utils/playground';

const selectionCommands = [
  {
    name: 'Run selected playground blocks',
    command: EXTENSION_COMMANDS.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
  },
  {
    name: 'Export To Python 3',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_PYTHON,
  },
  {
    name: 'Export To Java',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_JAVA,
  },
  {
    name: 'Export To C#',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_CSHARP,
  },
  {
    name: 'Export To Node.js',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_NODE,
  },
  {
    name: 'Export To Ruby',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_RUBY,
  },
  {
    name: 'Export To Go',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_GO,
  },
  {
    name: 'Export To Rust',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_RUST,
  },
  {
    name: 'Export To PHP',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_PHP,
  },
];

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

  createCodeAction({
    codeActionName,
    codeActionCommand,
  }: {
    codeActionName: string;
    codeActionCommand: string;
  }): vscode.CodeAction {
    const codeAction = new vscode.CodeAction(
      codeActionName,
      vscode.CodeActionKind.Empty
    );
    codeAction.command = {
      command: codeActionCommand,
      title: codeActionName,
      tooltip: codeActionName,
    };
    return codeAction;
  }

  provideCodeActions(): vscode.CodeAction[] | undefined {
    const editor = vscode.window.activeTextEditor;
    const codeActions: vscode.CodeAction[] = [];

    if (!isPlayground(editor?.document.uri) || !getSelectedText()) {
      return;
    }

    for (const { name, command } of selectionCommands) {
      codeActions.push(
        this.createCodeAction({
          codeActionName: name,
          codeActionCommand: command,
        })
      );
    }

    return codeActions;
  }
}
