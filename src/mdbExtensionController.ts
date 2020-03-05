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
import DatabaseTreeItem from './explorer/databaseTreeItem';
import ConnectionTreeItem from './explorer/connectionTreeItem';

const log = createLogger('commands');

// This class is the top-level controller for our extension.
// Commands which the extensions handles are defined in the function `activate`.
export default class MDBExtensionController implements vscode.Disposable {
  _connectionController: ConnectionController;
  _context?: vscode.ExtensionContext;
  _editorsController: EditorsController;
  _explorerController: ExplorerController;
  _statusView: StatusView;
  _storageController: StorageController;

  constructor(
    context: vscode.ExtensionContext,
    connectionController?: ConnectionController
  ) {
    this._statusView = new StatusView(context);
    this._storageController = new StorageController(context);

    if (connectionController) {
      this._connectionController = connectionController;
    } else {
      this._connectionController = new ConnectionController(
        this._statusView,
        this._storageController
      );
    }

    this._editorsController = new EditorsController();
    this._explorerController = new ExplorerController(this._connectionController);
  }

  registerCommand = (command, commandHandler: (...args: any[]) => Promise<boolean>): void => {
    if (!this._context) {
      // Not yet activated.
      return;
    }

    this._context.subscriptions.push(
      vscode.commands.registerCommand(command, commandHandler)
    );
  };

  public activate(context): void {
    this._context = context;
    this._connectionController.activate();
    this._explorerController.activate();
    this._editorsController.activate(context, this._connectionController);

    log.info('Registering commands...');

    // Register our extension's commands. These are the event handlers and
    // control the functionality of our extension.
    this.registerCommand('mdb.connect', () =>
      this._connectionController.addMongoDBConnection()
    );
    this.registerCommand('mdb.connectWithURI', () =>
      this._connectionController.connectWithURI()
    );

    this.registerCommand('mdb.disconnect', () =>
      this._connectionController.disconnect()
    );
    this.registerCommand('mdb.removeConnection', () =>
      this._connectionController.onRemoveMongoDBConnection()
    );

    this.registerCommand('mdb.openMongoDBShell', () => this.openMongoDBShell());

    this.registerCommand('mdb.createPlayground', () => this.createPlayground());

    this.registerEditorCommands();
    this.registerTreeViewCommands(context);

    log.info('Registered commands.');
  }

  registerEditorCommands(): void {
    this.registerCommand('mdb.codeLens.showMoreDocumentsClicked', (
      operationId,
      connectionInstanceId,
      namespace
    ) => {
      return this._editorsController.onViewMoreCollectionDocuments(
        operationId,
        connectionInstanceId,
        namespace
      );
    });
  }

  registerTreeViewCommands(context: vscode.ExtensionContext): void {
    this.registerCommand(
      'mdb.addConnection',
      () => this._connectionController.addMongoDBConnection()
    );
    this.registerCommand(
      'mdb.addConnectionWithURI',
      () => this._connectionController.connectWithURI()
    );
    this.registerCommand(
      'mdb.connectToConnectionTreeItem',
      (connectionTreeItem: ConnectionTreeItem) => {
        return this._connectionController.connectWithInstanceId(
          connectionTreeItem.connectionInstanceId
        );
      }
    );
    this.registerCommand(
      'mdb.disconnectFromConnectionTreeItem',
      () => {
        // In order for this command to be activated, the connection must
        // be the active connection, so we can just generally disconnect.
        return this._connectionController.disconnect();
      }
    );
    this.registerCommand(
      'mdb.refreshConnection',
      (connectionTreeItem: ConnectionTreeItem) => {
        connectionTreeItem.resetCache();
        this._explorerController.refresh();
        return Promise.resolve(true);
      }
    );
    this.registerCommand(
      'mdb.copyConnectionString',
      (element: ConnectionTreeItem) => {
        // TODO: Password obfuscation.
        const connectionString = this._connectionController.getConnectionStringFromConnectionId(
          element.connectionInstanceId
        );

        return new Promise((resolve, reject) => {
          vscode.env.clipboard.writeText(connectionString).then(() => {
            vscode.window.showInformationMessage('Copied to clipboard.');
            return resolve(true);
          }, reject);
        });
      }
    );
    this.registerCommand(
      'mdb.treeItemRemoveConnection',
      (element: ConnectionTreeItem) => this._connectionController.removeMongoDBConnection(
        element.connectionInstanceId
      )
    );
    this.registerCommand(
      'mdb.addDatabase',
      async (element: ConnectionTreeItem): Promise<boolean> => {
        if (!element) {
          vscode.window.showErrorMessage('Please wait for the connection to finish loading before adding a database.');
          return Promise.resolve(false);
        }

        if (element.connectionInstanceId !== this._connectionController.getActiveConnectionInstanceId()) {
          vscode.window.showErrorMessage('Please connect to this connection before adding a database.');
          return Promise.resolve(false);
        }

        if (this._connectionController.isDisconnecting()) {
          vscode.window.showErrorMessage('Unable to add database: currently disconnecting.');
          return Promise.resolve(false);
        }

        if (this._connectionController.isConnecting()) {
          vscode.window.showErrorMessage('Unable to add database: currently connecting.');
          return Promise.resolve(false);
        }

        return new Promise((resolve, reject) => {
          element.onAddDatabaseClicked(context).then(successfullyAddedDatabase => {
            if (successfullyAddedDatabase) {
              vscode.window.showInformationMessage('Database and collection successfully created.');

              // When we successfully added a database & collection, we need
              // to update the explorer view.
              this._explorerController.refresh();
            }
            resolve(true);
          }, reject);
        });
      }
    );
    this.registerCommand(
      'mdb.copyDatabaseName',
      (element: DatabaseTreeItem) => {
        return new Promise((resolve, reject) => {
          vscode.env.clipboard.writeText(element.databaseName).then(() => {
            vscode.window.showInformationMessage('Copied to clipboard.');
            return resolve(true);
          }, reject);
        });
      }
    );
    this.registerCommand(
      'mdb.dropDatabase',
      (element: DatabaseTreeItem): Promise<boolean> => {
        return element.onDropDatabaseClicked();
      }
    );
    this.registerCommand(
      'mdb.refreshDatabase',
      (databaseTreeItem: DatabaseTreeItem): Promise<boolean> => {
        databaseTreeItem.resetCache();
        return this._explorerController.refresh();
      }
    );
    this.registerCommand(
      'mdb.addCollection',
      async (element: DatabaseTreeItem): Promise<boolean> => {
        if (this._connectionController.isDisconnecting()) {
          vscode.window.showErrorMessage('Unable to add collection: currently disconnecting.');
          return Promise.resolve(false);
        }

        return new Promise((resolve, reject) => {
          element.onAddCollectionClicked(context).then(successfullyAddedCollection => {
            if (successfullyAddedCollection) {
              vscode.window.showInformationMessage('Collection successfully created.');

              // When we successfully added a collection, we need
              // to update the explorer view.
              this._explorerController.refresh();
            }
            resolve(true);
          }, reject);
        });
      }
    );
    this.registerCommand(
      'mdb.copyCollectionName',
      (element: CollectionTreeItem): Promise<boolean> => {
        return new Promise((resolve, reject) => {
          vscode.env.clipboard.writeText(element.collectionName).then(() => {
            vscode.window.showInformationMessage('Copied to clipboard.');
            return resolve(true);
          }, reject);
        });
      }
    );
    this.registerCommand(
      'mdb.dropCollection',
      (element: CollectionTreeItem): Promise<boolean> => {
        return element.onDropCollectionClicked();
      }
    );
    this.registerCommand(
      'mdb.viewCollectionDocuments',
      (element: CollectionTreeItem): Promise<boolean> => {
        const namespace = `${element.databaseName}.${element.collectionName}`;
        return this._editorsController.onViewCollectionDocuments(namespace);
      }
    );
    this.registerCommand(
      'mdb.refreshCollection',
      (collectionTreeItem: CollectionTreeItem): Promise<boolean> => {
        collectionTreeItem.resetCache();
        return this._explorerController.refresh();
      }
    );
  }

  public openMongoDBShell(): Promise<boolean> {
    let mdbConnectionString;
    if (this._connectionController) {
      const activeConnectionConfig = this._connectionController.getActiveConnectionConfig();
      mdbConnectionString = activeConnectionConfig
        ? activeConnectionConfig.driverUrl
        : '';
    }
    const mongoDBShell = vscode.window.createTerminal({
      name: 'MongoDB Shell',
      env: { MDB_CONNECTION_STRING: mdbConnectionString }
    });
    const shellCommand = vscode.workspace.getConfiguration('mdb').get('shell');
    mongoDBShell.sendText(
      `${shellCommand} $MDB_CONNECTION_STRING; unset MDB_CONNECTION_STRING`
    );
    mongoDBShell.show();

    return Promise.resolve(true);
  }

  public createPlayground(): Promise<boolean> {
    return new Promise(resolve => {
      vscode.workspace
        .openTextDocument({
          language: 'mongodb',
          content: '// The MongoDB playground'
        })
        .then((document) => {
          vscode.window.showTextDocument(document);
          resolve(true);
        });
    });
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
