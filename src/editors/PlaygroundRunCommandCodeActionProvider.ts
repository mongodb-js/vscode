import * as vscode from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import { isPlayground, getSelectedText } from '../utils/playground';

const exportToLanguageCommands = [
  {
    languageName: 'Python 3',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_PYTHON,
  },
  {
    languageName: 'Java',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_JAVA,
  },
  {
    languageName: 'C#',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_CSHARP,
  },
  {
    languageName: 'Node.js',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_NODE,
  },
  {
    languageName: 'Ruby',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_RUBY,
  },
  {
    languageName: 'Go',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_GO,
  },
  {
    languageName: 'Rust',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_RUST,
  },
  {
    languageName: 'PHP',
    command: EXTENSION_COMMANDS.MDB_EXPORT_TO_PHP,
  },
];

export default class PlaygroundRunCommandCodeActionProvider
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

  refresh(): void {
    this._onDidChangeCodeCodeAction.fire();
  }

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
    const codeActions: vscode.CodeAction[] = [];
    const editor = vscode.window.activeTextEditor;

    if (!isPlayground(editor?.document?.uri)) {
      return;
    }

    if (getSelectedText()) {
      codeActions.push(
        this.createCodeAction({
          codeActionName: 'Run selected playground blocks',
          codeActionCommand:
            EXTENSION_COMMANDS.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
        })
      );
    } else {
      codeActions.push(
        this.createCodeAction({
          codeActionName: 'Run playground',
          codeActionCommand: EXTENSION_COMMANDS.MDB_RUN_ALL_PLAYGROUND_BLOCKS,
        })
      );
    }

    for (const { languageName, command } of exportToLanguageCommands) {
      codeActions.push(
        this.createCodeAction({
          codeActionName: `Export To ${languageName}`,
          codeActionCommand: command,
        })
      );
    }

    return codeActions;
  }
}
