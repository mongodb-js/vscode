/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';

import ConnectionManager from './connectionManager';
import { StatusView } from './views';
import { createLogger } from './logging';

const log = createLogger('commands');

// This class is the top-level controller for our extension.
// Commands which the extensions handles are defined in the function `activate`.
export default class MDBExtensionController implements vscode.Disposable {
  private _connectionManager: ConnectionManager;
  private _statusView: StatusView;

  constructor(connectionManager?: ConnectionManager) {
    this._statusView = new StatusView();
    if (connectionManager) {
      this._connectionManager = connectionManager;
    } else {
      this._connectionManager = new ConnectionManager(this._statusView);
    }
  }

  public activate(context: vscode.ExtensionContext) {
    log.info('Registering commands...');

    // Register our extension's commands. These are the event handlers and control
    // the functionality of our extension.
    vscode.commands.registerCommand('mdb.connect', () => this._connectionManager.addMongoDBConnection());
    vscode.commands.registerCommand('mdb.connectWithURI', () => this._connectionManager.connectWithURI());

    vscode.commands.registerCommand('mdb.disconnect', () => this._connectionManager.disconnect());
    vscode.commands.registerCommand('mdb.removeConnection', () => this._connectionManager.removeMongoDBConnection());

    vscode.commands.registerCommand('mdb.openMongoDBShell', this.openMongoDBShell);

    log.info('Registered commands.');
  }

  public openMongoDBShell() {
    const mongoDBShell = vscode.window.createTerminal('MongoDB Shell');
    mongoDBShell.sendText('mongo');
    mongoDBShell.show();
  }

  dispose(): void {
    this.deactivate();
  }

  public deactivate(): void {
    // TODO: Cancel active queries/playgrounds.
    this._connectionManager.disconnect();
  }
}
