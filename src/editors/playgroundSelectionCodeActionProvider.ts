import * as vscode from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import { isPlayground, getSelectedText } from '../utils/playground';

export const EXPORT_TO_LANGUAGE_ALIASES = [
  { id: 'python', alias: 'Python 3' },
  { id: 'java', alias: 'Java' },
  { id: 'csharp', alias: 'C#' },
  { id: 'javascript', alias: 'Node.js' },
  { id: 'ruby', alias: 'Ruby' },
  { id: 'go', alias: 'Go' },
  { id: 'rust', alias: 'Rust' },
  { id: 'php', alias: 'PHP' },
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

  createCodeAction(command: vscode.Command): vscode.CodeAction {
    const codeAction = new vscode.CodeAction(
      command.title,
      vscode.CodeActionKind.Empty
    );
    codeAction.command = command;
    return codeAction;
  }

  provideCodeActions(): vscode.CodeAction[] | undefined {
    const editor = vscode.window.activeTextEditor;
    const copilot = vscode.extensions.getExtension('github.copilot-chat');
    let codeActions: vscode.CodeAction[] = [
      this.createCodeAction({
        title: 'Run selected playground blocks',
        command: EXTENSION_COMMANDS.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
      }),
    ];

    if (!isPlayground(editor?.document.uri) || !getSelectedText()) {
      return;
    }

    if (copilot?.isActive) {
      codeActions = [
        ...codeActions,
        ...EXPORT_TO_LANGUAGE_ALIASES.map(({ id, alias }) =>
          this.createCodeAction({
            title: `Export To ${alias}`,
            command: EXTENSION_COMMANDS.MDB_EXPORT_TO_LANGUAGE,
            arguments: [id],
          })
        ),
      ];
    }

    return codeActions;
  }
}
