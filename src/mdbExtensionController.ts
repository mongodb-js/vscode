/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';

import ConnectionController from './connectionController';
import { ExplorerController } from './explorer';
import { StatusView } from './views';
import { createLogger } from './logging';

const log = createLogger('commands');

// This class is the top-level controller for our extension.
// Commands which the extensions handles are defined in the function `activate`.
export default class MDBExtensionController implements vscode.Disposable {
  private _connectionController: ConnectionController;
  private _explorerController: ExplorerController;
  private _statusView: StatusView;

  constructor(connectionController?: ConnectionController, _explorerController?: ExplorerController) {
    this._statusView = new StatusView();
    if (connectionController) {
      this._connectionController = connectionController;
    } else {
      this._connectionController = new ConnectionController(this._statusView);
    }

    if (_explorerController) {
      this._explorerController = _explorerController;
    } else {
      this._explorerController = new ExplorerController();
    }
  }

  public activate(context: vscode.ExtensionContext) {
    log.info('Registering commands...');

    // Register our extension's commands. These are the event handlers and control
    // the functionality of our extension.
    vscode.commands.registerCommand('mdb.connect', () => this._connectionController.addMongoDBConnection());
    vscode.commands.registerCommand('mdb.connectWithURI', () => this._connectionController.connectWithURI());

    vscode.commands.registerCommand('mdb.disconnect', () => this._connectionController.disconnect());
    vscode.commands.registerCommand('mdb.removeConnection', () => this._connectionController.removeMongoDBConnection());

    vscode.commands.registerCommand('mdb.openMongoDBShell', this.openMongoDBShell);

    vscode.commands.registerCommand('mdb.refresh', () => this._explorerController.refresh());
    vscode.commands.registerCommand('mdb.reload', () => this._explorerController.refresh());

    log.info('Registered commands.');

    this._explorerController.activate(this._connectionController);
  }

  public openMongoDBShell() {
    const mongoDBShell = vscode.window.createTerminal('MongoDB Shell');
    mongoDBShell.sendText('mongo');
    mongoDBShell.show();
  }

  dispose() {
    this.deactivate();
  }

  public deactivate() {
    // TODO: Cancel active queries/playgrounds.
    this._connectionController.disconnect();
    this._explorerController.deactivate();
  }
}
