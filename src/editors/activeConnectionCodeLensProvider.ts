import * as vscode from 'vscode';

import EXTENSION_COMMANDS from '../commands';
import type ConnectionController from '../connectionController';
import { isPlayground } from '../utils/playground';
import { getDBFromConnectionString } from '../utils/connection-string-db';
import { DataServiceEventTypes } from '../connectionController';

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
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      this._activeConnectionChangedHandler
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
      command: EXTENSION_COMMANDS.MDB_CHANGE_ACTIVE_CONNECTION,
      arguments: [],
    };

    return [codeLens];
  }

  deactivate(): void {
    this._connectionController.removeEventListener(
      DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED,
      this._activeConnectionChangedHandler
    );
  }
}
