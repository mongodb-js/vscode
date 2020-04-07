/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';

import ConnectionController from './connectionController';
import { EditorsController, PlaygroundController } from './editors';
import { ExplorerController, CollectionTreeItem } from './explorer';
import { LanguageServerController } from './language';
import { TelemetryController } from './telemetry';
import { StatusView } from './views';
import { createLogger } from './logging';
import { StorageController } from './storage';
import DatabaseTreeItem from './explorer/databaseTreeItem';
import ConnectionTreeItem from './explorer/connectionTreeItem';
import SchemaTreeItem from './explorer/schemaTreeItem';
import DocumentTreeItem from './explorer/documentTreeItem';
import WebviewController from './views/webviewController';

const log = createLogger('commands');

// This class is the top-level controller for our extension.
// Commands which the extensions handles are defined in the function `activate`.
export default class MDBExtensionController implements vscode.Disposable {
  _connectionController: ConnectionController;
  _context: vscode.ExtensionContext;
  _editorsController: EditorsController;
  _playgroundController: PlaygroundController;
  _explorerController: ExplorerController;
  _statusView: StatusView;
  _storageController: StorageController;
  _telemetryController: TelemetryController;
  _languageServerController: LanguageServerController;
  _webviewController: WebviewController;

  constructor(
    context: vscode.ExtensionContext,
    connectionController?: ConnectionController
  ) {
    this._context = context;

    this._statusView = new StatusView(context);
    this._storageController = new StorageController(context);
    this._telemetryController = new TelemetryController(
      this._storageController
    );

    if (connectionController) {
      this._connectionController = connectionController;
    } else {
      this._connectionController = new ConnectionController(
        this._statusView,
        this._storageController
      );
    }

    this._languageServerController = new LanguageServerController(context);
    this._editorsController = new EditorsController(
      context,
      this._connectionController
    );
    this._explorerController = new ExplorerController(
      this._connectionController
    );
    this._playgroundController = new PlaygroundController(
      context,
      this._connectionController,
      this._languageServerController,
      this._telemetryController
    );
    this._webviewController = new WebviewController(this._connectionController);
  }

  activate(): void {
    this._connectionController.loadSavedConnections();
    this._explorerController.createTreeView();
    this._telemetryController.activate();
    this._languageServerController.activate();

    log.info('Registering commands...');

    // Register our extension's commands. These are the event handlers and
    // control the functionality of our extension.
    this.registerCommand('mdb.connect', () =>
      this._webviewController.showConnectForm(this._context)
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

    this.registerCommand('mdb.createPlayground', () =>
      this._playgroundController.createPlayground()
    );
    this.registerCommand('mdb.runAllPlaygroundBlocks', () =>
      this._playgroundController.runAllPlaygroundBlocks()
    );
    this.registerCommand(
      'mdb.showActiveConnectionInPlayground',
      (message: string) =>
        this._playgroundController.showActiveConnectionInPlayground(message)
    );

    this.registerEditorCommands();
    this.registerTreeViewCommands();

    log.info('Registered commands.');
  }

  registerCommand = (
    command,
    commandHandler: (...args: any[]) => Promise<boolean>
  ): void => {
    this._context.subscriptions.push(
      vscode.commands.registerCommand(command, commandHandler)
    );
  };

  registerEditorCommands(): void {
    this.registerCommand(
      'mdb.codeLens.showMoreDocumentsClicked',
      (operationId, connectionId, namespace) => {
        return this._editorsController.onViewMoreCollectionDocuments(
          operationId,
          connectionId,
          namespace
        );
      }
    );
  }

  registerTreeViewCommands(): void {
    this.registerCommand('mdb.addConnection', () =>
      this._webviewController.showConnectForm(this._context)
    );
    this.registerCommand('mdb.addConnectionWithURI', () =>
      this._connectionController.connectWithURI()
    );
    this.registerCommand(
      'mdb.connectToConnectionTreeItem',
      (connectionTreeItem: ConnectionTreeItem) => {
        return this._connectionController.connectWithConnectionId(
          connectionTreeItem.connectionId
        );
      }
    );
    this.registerCommand('mdb.disconnectFromConnectionTreeItem', () => {
      // In order for this command to be activated, the connection must
      // be the active connection, so we can just generally disconnect.
      return this._connectionController.disconnect();
    });
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
          element.connectionId
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
      (element: ConnectionTreeItem) =>
        this._connectionController.removeMongoDBConnection(element.connectionId)
    );
    this.registerCommand(
      'mdb.renameConnection',
      (element: ConnectionTreeItem) =>
        this._connectionController.renameConnection(element.connectionId)
    );
    this.registerCommand(
      'mdb.addDatabase',
      async (element: ConnectionTreeItem): Promise<boolean> => {
        if (!element) {
          vscode.window.showErrorMessage(
            'Please wait for the connection to finish loading before adding a database.'
          );
          return Promise.resolve(false);
        }

        if (
          element.connectionId !==
          this._connectionController.getActiveConnectionId()
        ) {
          vscode.window.showErrorMessage(
            'Please connect to this connection before adding a database.'
          );
          return Promise.resolve(false);
        }

        if (this._connectionController.isDisconnecting()) {
          vscode.window.showErrorMessage(
            'Unable to add database: currently disconnecting.'
          );
          return Promise.resolve(false);
        }

        if (this._connectionController.isConnecting()) {
          vscode.window.showErrorMessage(
            'Unable to add database: currently connecting.'
          );
          return Promise.resolve(false);
        }

        return new Promise((resolve, reject) => {
          element
            .onAddDatabaseClicked(this._context)
            .then((successfullyAddedDatabase) => {
              if (successfullyAddedDatabase) {
                vscode.window.showInformationMessage(
                  'Database and collection successfully created.'
                );

                // When we successfully added a database & collection, we need
                // to update the explorer view.
                this._explorerController.refresh();
              }
              resolve(successfullyAddedDatabase);
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
        return new Promise((resolve, reject) => {
          element
            .onDropDatabaseClicked()
            .then((successfullyDroppedDatabase) => {
              if (successfullyDroppedDatabase) {
                vscode.window.showInformationMessage(
                  'Database successfully dropped.'
                );

                // When we successfully drop a database, we need
                // to update the explorer view.
                this._explorerController.refresh();
              }

              resolve(successfullyDroppedDatabase);
            }, reject);
        });
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
          vscode.window.showErrorMessage(
            'Unable to add collection: currently disconnecting.'
          );
          return Promise.resolve(false);
        }

        return new Promise((resolve, reject) => {
          element
            .onAddCollectionClicked(this._context)
            .then((successfullyAddedCollection) => {
              if (successfullyAddedCollection) {
                vscode.window.showInformationMessage(
                  'Collection successfully created.'
                );

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
        return new Promise((resolve, reject) => {
          element
            .onDropCollectionClicked()
            .then((successfullyDroppedCollection) => {
              if (successfullyDroppedCollection) {
                vscode.window.showInformationMessage(
                  'Collection successfully dropped.'
                );

                // When we successfully drop a collection, we need
                // to update the explorer view.
                this._explorerController.refresh();
              }

              resolve(successfullyDroppedCollection);
            }, reject);
        });
      }
    );
    this.registerCommand(
      'mdb.viewDocument',
      (element: DocumentTreeItem): Promise<boolean> => {
        return this._editorsController.onViewDocument(
          element.namespace,
          element.documentId
        );
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
    this.registerCommand(
      'mdb.refreshSchema',
      (schemaTreeItem: SchemaTreeItem): Promise<boolean> => {
        schemaTreeItem.resetCache();
        return this._explorerController.refresh();
      }
    );
  }

  public openMongoDBShell(): Promise<boolean> {
    let mdbConnectionString;
    if (this._connectionController) {
      const activeConnectionDriverUrl = this._connectionController.getActiveConnectionDriverUrl();
      mdbConnectionString = activeConnectionDriverUrl
        ? activeConnectionDriverUrl
        : '';
    }
    if (!mdbConnectionString) {
      vscode.window.showErrorMessage(
        'You need to be connected before launching the MongoDB Shell.'
      );
      return Promise.resolve(false);
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

  dispose(): void {
    this.deactivate();
  }

  public deactivate(): void {
    // TODO: Cancel active queries/playgrounds.
    this._connectionController.disconnect();
    this._explorerController.deactivate();
    this._playgroundController.deactivate();
    this._telemetryController.deactivate();
    this._languageServerController.deactivate();
  }
}
