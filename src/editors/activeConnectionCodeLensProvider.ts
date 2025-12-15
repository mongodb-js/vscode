import * as vscode from 'vscode';

import ExtensionCommand from '../commands';
import type ConnectionController from '../connectionController';
import { isPlayground } from '../utils/playground';
import { getDBFromConnectionString } from '../utils/connection-string-db';

export default class ActiveConnectionCodeLensProvider
  implements vscode.CodeLensProvider
{
  _connectionController: ConnectionController;
  _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  _activeConnectionChangedHandler: () => void;

  readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(connectionController: ConnectionController) {
    this._connectionController = connectionController;

    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });

    this._activeConnectionChangedHandler = (): void => {
      this._onDidChangeCodeLenses.fire();
    };
    this._connectionController.addEventListener(
      'ACTIVE_CONNECTION_CHANGED',
      this._activeConnectionChangedHandler,
    );
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!isPlayground(document.uri)) {
      return [];
    }

    const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0));
    let message = '';

    if (this._connectionController.isConnecting()) {
      message = 'Connecting...';
    } else if (this._connectionController.getActiveDataService()) {
      const connectionString =
        this._connectionController.getMongoClientConnectionOptions()?.url;
      const defaultDB = connectionString
        ? getDBFromConnectionString(connectionString)
        : null;
      message = defaultDB
        ? `$(mdb-connection-active)Connected to ${this._connectionController.getActiveConnectionName()} with default database ${defaultDB}`
        : `$(mdb-connection-active)Connected to ${this._connectionController.getActiveConnectionName()}`;
    } else {
      message = '$(mdb-connection-inactive)Connect';
    }

    codeLens.command = {
      title: message,
      command: ExtensionCommand.mdbChangeActiveConnection,
      arguments: [],
    };

    return [codeLens];
  }

  deactivate(): void {
    this._connectionController.removeEventListener(
      'ACTIVE_CONNECTION_CHANGED',
      this._activeConnectionChangedHandler,
    );
  }
}
