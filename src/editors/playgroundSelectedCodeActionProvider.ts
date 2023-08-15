import * as vscode from 'vscode';
import type { TextEditor } from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import { ExportToLanguageMode } from '../types/playgroundType';
import { isPlayground } from '../utils/playground';

export default class PlaygroundSelectedCodeActionProvider
  implements vscode.CodeActionProvider
{
  _onDidChangeCodeCodeAction: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  selection?: vscode.Selection;
  mode?: ExportToLanguageMode;
  activeTextEditor?: TextEditor;

  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor() {
    this.activeTextEditor = vscode.window.activeTextEditor;
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeCodeAction.fire();
    });
  }

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeCodeAction.event;

  setActiveTextEditor(activeTextEditor?: TextEditor) {
    this.activeTextEditor = activeTextEditor;
    this._onDidChangeCodeCodeAction.fire();
  }

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

  isPlayground(): boolean {
    return isPlayground(this.activeTextEditor?.document.uri);
  }

  provideCodeActions(): vscode.CodeAction[] | undefined {
    if (!this.selection || !this.isPlayground()) {
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

      const exportToGoCommand = new vscode.CodeAction(
        'Export To Go',
        vscode.CodeActionKind.Empty
      );
      exportToGoCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_GO,
        title: 'Export To Go',
        tooltip: 'Export To Go',
      };
      codeActions.push(exportToGoCommand);
    }

    return codeActions;
  }
}
