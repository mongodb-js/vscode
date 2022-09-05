import * as vscode from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import { ExportToLanguageMode } from '../types/playgroundType';

export default class CodeActionProvider implements vscode.CodeActionProvider {
  _onDidChangeCodeCodeAction: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  selection?: vscode.Selection;
  mode?: ExportToLanguageMode;

  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeCodeAction.fire();
    });
  }

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeCodeAction.event;

  refresh({
    selection,
    mode,
  }: {
    selection?: vscode.Selection;
    mode?: ExportToLanguageMode;
  }): void {
    this.selection = selection;
    this.mode = mode;
    this._onDidChangeCodeCodeAction.fire();
  }

  provideCodeActions(): vscode.CodeAction[] | undefined {
    if (!this.selection) {
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

    if (
      this.mode === ExportToLanguageMode.QUERY ||
      this.mode === ExportToLanguageMode.AGGREGATION
    ) {
      const exportToPythonCommand = new vscode.CodeAction(
        'Export To Python 3',
        vscode.CodeActionKind.Empty
      );
      exportToPythonCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_PYTHON,
        title: 'Export To Python 3',
        tooltip: 'Export To Python 3',
      };
      codeActions.push(exportToPythonCommand);

      const exportToJavaCommand = new vscode.CodeAction(
        'Export To Java',
        vscode.CodeActionKind.Empty
      );
      exportToJavaCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_JAVA,
        title: 'Export To Java',
        tooltip: 'Export To Java',
      };
      codeActions.push(exportToJavaCommand);

      const exportToCsharpCommand = new vscode.CodeAction(
        'Export To C#',
        vscode.CodeActionKind.Empty
      );
      exportToCsharpCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_CSHARP,
        title: 'Export To C#',
        tooltip: 'Export To C#',
      };
      codeActions.push(exportToCsharpCommand);

      const exportToJSCommand = new vscode.CodeAction(
        'Export To Node.js',
        vscode.CodeActionKind.Empty
      );
      exportToJSCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_NODE,
        title: 'Export To Node.js',
        tooltip: 'Export To Node.js',
      };
      codeActions.push(exportToJSCommand);

      const exportToRubyCommand = new vscode.CodeAction(
        'Export To Ruby',
        vscode.CodeActionKind.Empty
      );
      exportToRubyCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_RUBY,
        title: 'Export To Ruby',
        tooltip: 'Export To Ruby',
      };
      codeActions.push(exportToRubyCommand);
    }

    return codeActions;
  }
}
