/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';

import ConnectionManager from './connectionManager';
import { createLogger } from './logging';

const log = createLogger('commands');

// This class is the top-level controller for our extension.
// Commands which the extensions handles are defined in the function `activate`.
export default class MDBExtensionController implements vscode.Disposable {
  private _connectionManager: ConnectionManager = new ConnectionManager();

  public activate(context: vscode.ExtensionContext) {
    console.group('registerCommands');

    // Register our extension's commands. These are the event handlers and control
    // the functionality of our extension.
    vscode.commands.registerCommand('mdb.connect', () => this._connectionManager.addMongoDBConnection());
    vscode.commands.registerCommand('mdb.addConnection', () => this._connectionManager.addMongoDBConnection());

    vscode.commands.registerCommand('mdb.connectWithURI', () => this._connectionManager.connectWithURI());
    vscode.commands.registerCommand('mdb.addConnectionWithURI', () => this._connectionManager.connectWithURI());

    vscode.commands.registerCommand('mdb.removeConnection', () => this._connectionManager.removeMongoDBConnection());

    vscode.commands.registerCommand('mdb.launchShell', this.launchMongoShell);

    console.groupEnd();
  }

  public launchMongoShell() {
    const mongoShell = vscode.window.createTerminal('Mongo Shell');
    mongoShell.sendText('mongo');
    mongoShell.show();
  }

  dispose(): void {
    this.deactivate();
  }

  public deactivate(): void {
    // TODO: Close all active connections & end active queries/playgrounds.
  }
}
