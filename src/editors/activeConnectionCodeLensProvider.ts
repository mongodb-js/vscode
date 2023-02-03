import * as vscode from 'vscode';
import { TextEditor } from 'vscode';
import EXTENSION_COMMANDS from '../commands';
import ConnectionController from '../connectionController';
import { isPlayground } from '../utils/playground';

export default class ActiveConnectionCodeLensProvider
  implements vscode.CodeLensProvider
{
  _connectionController: ConnectionController;
  _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  _activeTextEditor?: TextEditor;

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(connectionController: ConnectionController) {
    this._connectionController = connectionController;
    this._activeTextEditor = vscode.window.activeTextEditor;

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });

    vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
      if (editor?.document.languageId !== 'Log') {
        this._activeTextEditor = editor;
      }
    });
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(): vscode.CodeLens[] {
    const editorUri = this._activeTextEditor?.document.uri;

    if (!isPlayground(editorUri)) {
      return [];
    }

    const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0));
    let message = '';

    if (this._connectionController.isConnecting()) {
      message = 'Connecting...';
    } else if (this._connectionController.getActiveDataService()) {
      message = `Currently connected to ${this._connectionController.getActiveConnectionName()}. Click here to change connection.`;
    } else {
      message = 'Disconnected. Click here to connect.';
    }

    codeLens.command = {
      title: message,
      command: EXTENSION_COMMANDS.MDB_CHANGE_ACTIVE_CONNECTION,
      arguments: [],
    };

    return [codeLens];
  }
}
