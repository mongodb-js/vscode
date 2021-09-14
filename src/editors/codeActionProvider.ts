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

    const codeActions: vscode.CodeAction[] = [];

    const runSelectedPlaygroundBlockCommand = new vscode.CodeAction('Run selected playground blocks', vscode.CodeActionKind.Empty);
    runSelectedPlaygroundBlockCommand.command = {
      command: EXTENSION_COMMANDS.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
      title: 'Run selected playground blocks',
      tooltip: 'Run selected playground blocks'
    };
    codeActions.push(runSelectedPlaygroundBlockCommand);

    if (this._playgroundController._selectedText.trim().startsWith('[')) {
      const exportToPythonCommand = new vscode.CodeAction('Export To Python 3', vscode.CodeActionKind.Empty);
      exportToPythonCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_LANGUAGE,
        title: 'Export To Python 3',
        tooltip: 'Export To Python 3',
        arguments: ['python']
      };
      codeActions.push(exportToPythonCommand);

      const exportToJavaCommand = new vscode.CodeAction('Export To Java', vscode.CodeActionKind.Empty);
      exportToJavaCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_LANGUAGE,
        title: 'Export To Java',
        tooltip: 'Export To Java',
        arguments: ['java']
      };
      codeActions.push(exportToJavaCommand);

      const exportToCsharpCommand = new vscode.CodeAction('Export To C#', vscode.CodeActionKind.Empty);
      exportToCsharpCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_LANGUAGE,
        title: 'Export To C#',
        tooltip: 'Export To C#',
        arguments: ['csharp']
      };
      codeActions.push(exportToCsharpCommand);

      const exportToJSCommand = new vscode.CodeAction('Export To Node', vscode.CodeActionKind.Empty);
      exportToJSCommand.command = {
        command: EXTENSION_COMMANDS.MDB_EXPORT_TO_LANGUAGE,
        title: 'Export To Node',
        tooltip: 'Export To Node',
        arguments: ['javascript']
      };
      codeActions.push(exportToJSCommand);
    }

    return codeActions;
  }
}
