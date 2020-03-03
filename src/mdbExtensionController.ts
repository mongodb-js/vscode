/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';
import ns from 'mongodb-ns';

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

  constructor(
    context: vscode.ExtensionContext,
    connectionController?: ConnectionController
  ) {
    this._statusView = new StatusView();
    const storageController = new StorageController(context);

    if (connectionController) {
      this._connectionController = connectionController;
    } else {
      this._connectionController = new ConnectionController(
        this._statusView,
        storageController
      );
    }

    this._editorsController = new EditorsController();
    this._explorerController = new ExplorerController();
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
    this._explorerController.activate(this._connectionController);
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

    this.registerCommand('mdb.refresh', () =>
      this._explorerController.refresh()
    );
    this.registerCommand('mdb.reload', () =>
      this._explorerController.refresh()
    );

    // Register tree view commands.
    this.registerCommand(
      'mdb.addConnection',
      () => this._connectionController.addMongoDBConnection()
    );
    this.registerCommand(
      'mdb.addConnectionWithURI',
      () => this._connectionController.connectWithURI()
    );
    this.registerCommand(
      'mdb.refreshConnection',
      (connectionTreeItem: ConnectionTreeItem) => {
        connectionTreeItem.setCacheExpired();
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
        if (element.connectionInstanceId !== this._connectionController.getActiveConnectionInstanceId()) {
          return Promise.reject(new Error('Please connect to this connection before adding a database.'));
        }

        let databaseName;
        try {
          databaseName = await vscode.window.showInputBox({
            value: '',
            placeHolder:
              'e.g. myNewDB',
            prompt: 'Enter the new database name.',
            validateInput: (inputDatabaseName: any) => {
              if (
                inputDatabaseName
                && inputDatabaseName.length > 0
                && !ns(inputDatabaseName).validDatabaseName
              ) {
                return 'MongoDB database names cannot contain `/\\. "$` or the null character, and must be fewer than 64 characters';
              }

              return null;
            }
          });
        } catch (e) {
          return Promise.reject(new Error(`An error occured parsing the database name: ${e}`));
        }

        if (!databaseName) {
          return Promise.resolve(false);
        }

        let collectionName;
        try {
          collectionName = await vscode.window.showInputBox({
            value: '',
            placeHolder:
              'e.g. myNewCollection',
            prompt: 'Enter the new collection name. (A database must have a collection to be created.)',
            validateInput: (inputCollectionName: any) => {
              if (!inputCollectionName) {
                return null;
              }

              if (!ns(`${databaseName}.${inputCollectionName}`).validCollectionName) {
                return 'MongoDB collection names cannot contain `/\\. "$` or the null character, and must be fewer than 64 characters';
              }

              if (ns(`${databaseName}.${inputCollectionName}`).system) {
                return 'MongoDB collection names cannot start with "system.". (Reserved for internal use.)';
              }

              return null;
            }
          });
        } catch (e) {
          return Promise.reject(new Error(
            `An error occured parsing the collection name: ${e}`
          ));
        }

        if (!collectionName) {
          return Promise.resolve(false);
        }

        if (this._connectionController.isDisconnecting()) {
          return Promise.reject(new Error('Unable to add collection: currently disconnecting.'));
        }

        if (this._connectionController.isConnecting()) {
          return Promise.reject(new Error('Unable to add collection: currently connecting.'));
        }

        if (element.connectionInstanceId !== this._connectionController.getActiveConnectionInstanceId()) {
          return Promise.reject(new Error(
            'Please connect to this connection before adding a database.'
          ));
        }

        return new Promise((resolve, reject) => {
          this._connectionController.getActiveConnection().createCollection(
            `${databaseName}.${collectionName}`,
            {}, // No options.
            (err) => {
              if (err) {
                return reject(new Error(`Create collection failed: ${err}`));
              }

              // TODO: We need to refresh the tree view or add the node.
              return resolve(true);
            }
          );
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
      'mdb.refreshDatabase',
      (databaseTreeItem: DatabaseTreeItem) => {
        databaseTreeItem.setCacheExpired();
        return this._explorerController.refresh();
      }
    );
    this.registerCommand(
      'mdb.addCollection',
      async (element: DatabaseTreeItem): Promise<boolean> => {
        const databaseName = element.databaseName;

        let collectionName;
        try {
          collectionName = await vscode.window.showInputBox({
            value: '',
            placeHolder:
              'e.g. myNewCollection',
            prompt: 'Enter the new collection name.',
            validateInput: (inputCollectionName: any) => {
              if (!inputCollectionName) {
                return null;
              }

              if (!ns(`${databaseName}.${inputCollectionName}`).validCollectionName) {
                return 'MongoDB collection names cannot contain `/\\. "$` or the null character, and must be fewer than 64 characters';
              }

              if (ns(`${databaseName}.${inputCollectionName}`).system) {
                return 'MongoDB collection names cannot start with "system.". (Reserved for internal use.)';
              }

              return null;
            }
          });
        } catch (e) {
          return Promise.reject(`An error occured parsing the collection name: ${e}`);
        }

        if (!collectionName) {
          return Promise.resolve(false);
        }

        if (this._connectionController.isDisconnecting()) {
          return Promise.reject(new Error('Unable to add collection: currently disconnecting.'));
        }

        return new Promise((resolve, reject) => {
          this._connectionController.getActiveConnection().createCollection(
            `${databaseName}.${collectionName}`,
            {}, // No options.
            (err) => {
              if (err) {
                return reject(new Error(`Create collection failed: ${err}`));
              }

              // TODO: We need to refresh the tree view or add the node.
              return resolve(true);
            }
          );
        });
      }
    );
    this.registerCommand(
      'mdb.copyCollectionName',
      (element: CollectionTreeItem) => {
        return new Promise((resolve, reject) => {
          vscode.env.clipboard.writeText(element.collectionName).then(() => {
            vscode.window.showInformationMessage('Copied to clipboard.');
            return resolve(true);
          }, reject);
        });
      }
    );
    this.registerCommand(
      'mdb.viewCollectionDocuments',
      (element: CollectionTreeItem) => {
        const namespace = `${element.databaseName}.${element.collectionName}`;
        return this._editorsController.onViewCollectionDocuments(namespace);
      }
    );
    this.registerCommand(
      'mdb.refreshCollection',
      (collectionTreeItem: CollectionTreeItem) => {
        collectionTreeItem.setCacheExpired();
        return this._explorerController.refresh();
      }
    );

    this.registerCommand(
      'mdb.codeLens.showMoreDocumentsClicked',
      (operationId, connectionInstanceId, namespace) => {
        return this._editorsController.onViewMoreCollectionDocuments(
          operationId,
          connectionInstanceId,
          namespace
        );
      }
    );

    log.info('Registered commands.');
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

  public createPlayground(): void {
    vscode.workspace
      .openTextDocument({
        language: 'mongodb',
        content: '// The MongoDB playground'
      })
      .then((document) => {
        vscode.window.showTextDocument(document);
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
