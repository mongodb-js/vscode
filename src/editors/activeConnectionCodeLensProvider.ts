import * as vscode from 'vscode';
import type { TextEditor } from 'vscode';
import EXTENSION_COMMANDS from '../commands';
import type ConnectionController from '../connectionController';
import { isPlayground } from '../utils/playground';

export default class ActiveConnectionCodeLensProvider
  implements vscode.CodeLensProvider
{
  _connectionController: ConnectionController;
  _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  activeTextEditor?: TextEditor;

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(connectionController: ConnectionController) {
    this._connectionController = connectionController;
    this.activeTextEditor = vscode.window.activeTextEditor;

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  setActiveTextEditor(activeTextEditor?: TextEditor) {
    this.activeTextEditor = activeTextEditor;
    this._onDidChangeCodeLenses.fire();
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  isPlayground(): boolean {
    return isPlayground(this.activeTextEditor?.document.uri);
  }

  provideCodeLenses(): vscode.CodeLens[] {
    if (!this.isPlayground()) {
      return [];
    }

    const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0));
    let message = '';

    if (this._connectionController.isConnecting()) {
      message = 'Connecting...';
    } else if (this._connectionController.getActiveDataService()) {
      const defaultDB =
        this._connectionController.getActiveConnectionDefaultDB();
      message = defaultDB
        ? `Currently connected to ${this._connectionController.getActiveConnectionName()} with default database ${defaultDB}. Click here to change connection.`
        : `Currently connected to ${this._connectionController.getActiveConnectionName()}. Click here to change connection.`;
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
