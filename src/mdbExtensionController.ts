/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';

import ConnectionController from './connectionController';
import { EditorsController } from './editors';
import { ExplorerController, CollectionTreeItem } from './explorer';
import { StatusView } from './views';
import { createLogger } from './logging';
import { StorageController } from './storage';

const log = createLogger('commands');

// This class is the top-level controller for our extension.
// Commands which the extensions handles are defined in the function `activate`.
export default class MDBExtensionController implements vscode.Disposable {
  _connectionController: ConnectionController;
  _context?: vscode.ExtensionContext;
  _editorsController: EditorsController;
  _explorerController: ExplorerController;
  _statusView: StatusView;

  constructor(context: vscode.ExtensionContext, connectionController?: ConnectionController) {
    this._statusView = new StatusView();
    const storageController = new StorageController(context);

    if (connectionController) {
      this._connectionController = connectionController;
    } else {
      this._connectionController = new ConnectionController(this._statusView, storageController);
    }

    this._editorsController = new EditorsController();
    this._explorerController = new ExplorerController();
  }

  registerCommand = (command, commandHandler): void => {
    if (!this._context) {
      // Not yet activated.
      return;
    }

    this._context.subscriptions.push(vscode.commands.registerCommand(command, commandHandler));
  };

  public activate(context): void {
    this._context = context;
    this._connectionController.activate();
    this._explorerController.activate(this._connectionController);
    this._editorsController.activate(context, this._connectionController);

    log.info('Registering commands...');

    // Register our extension's commands. These are the event handlers and
    // control the functionality of our extension.
    this.registerCommand('mdb.connect', () => this._connectionController.addMongoDBConnection());
    this.registerCommand('mdb.connectWithURI', () => this._connectionController.connectWithURI());

    this.registerCommand('mdb.disconnect', () => this._connectionController.disconnect());
    this.registerCommand('mdb.removeConnection', () => this._connectionController.removeMongoDBConnection());

    this.registerCommand('mdb.openMongoDBShell', () => this.openMongoDBShell());

    this.registerCommand('mdb.refresh', () => this._explorerController.refresh());
    this.registerCommand('mdb.reload', () => this._explorerController.refresh());

    this.registerCommand(
      'mdb.viewCollectionDocuments',
      (element: CollectionTreeItem) => {
        const namespace = `${element.databaseName}.${element.collectionName}`;
        return this._editorsController.onViewCollectionDocuments(namespace);
      });

    this.registerCommand('mdb.codeLens.showMoreDocumentsClicked', (
      operationId,
      connectionInstanceId,
      namespace
    ) => {
      return this._editorsController.onViewMoreCollectionDocuments(operationId, connectionInstanceId, namespace);
    });

    log.info('Registered commands.');
  }

  public openMongoDBShell(): void {
    let mdbConnectionString;
    if (this._connectionController) {
      const activeConnectionConfig = this._connectionController.getActiveConnectionConfig();
      mdbConnectionString = activeConnectionConfig ? activeConnectionConfig.driverUrl : '';
    }
    const mongoDBShell = vscode.window.createTerminal({ name: 'MongoDB Shell', env: { MDB_CONNECTION_STRING: mdbConnectionString } });
    const shellCommand = vscode.workspace.getConfiguration('mdb').get('shell');
    mongoDBShell.sendText(`${shellCommand} $MDB_CONNECTION_STRING; unset MDB_CONNECTION_STRING`);
    mongoDBShell.show();
  }

  dispose(): void {
    this.deactivate();
  }

  public deactivate(): void {
    // TODO: Cancel active queries/playgrounds.
    this._connectionController.disconnect();
    this._explorerController.deactivate();
  }
}
