/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';

import ConnectionController from './connectionController';
import launchMongoShell from './commands/launchMongoShell';
import { EditorsController, PlaygroundController } from './editors';
import {
  ExplorerController,
  PlaygroundsExplorer,
  HelpExplorer,
  CollectionTreeItem
} from './explorer';
import { LanguageServerController } from './language';
import TelemetryController from './telemetry/telemetryController';
import { StatusView } from './views';
import { createLogger } from './logging';
import { StorageController } from './storage';
import ConnectionTreeItem from './explorer/connectionTreeItem';
import DatabaseTreeItem from './explorer/databaseTreeItem';
import SchemaTreeItem from './explorer/schemaTreeItem';
import DocumentListTreeItem from './explorer/documentListTreeItem';
import DocumentTreeItem from './explorer/documentTreeItem';
import WebviewController from './views/webviewController';
import FieldTreeItem from './explorer/fieldTreeItem';
import IndexListTreeItem from './explorer/indexListTreeItem';
import PlaygroundsTreeItem from './explorer/playgroundsTreeItem';

const log = createLogger('commands');

// This class is the top-level controller for our extension.
// Commands which the extensions handles are defined in the function `activate`.
export default class MDBExtensionController implements vscode.Disposable {
  _connectionController: ConnectionController;
  _context: vscode.ExtensionContext;
  _editorsController: EditorsController;
  _playgroundController: PlaygroundController;
  _explorerController: ExplorerController;
  _helpExplorer: HelpExplorer;
  _playgroundsExplorer: PlaygroundsExplorer;
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
      this._storageController,
      context
    );

    if (connectionController) {
      this._connectionController = connectionController;
    } else {
      this._connectionController = new ConnectionController(
        this._statusView,
        this._storageController,
        this._telemetryController
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
    this._helpExplorer = new HelpExplorer();
    this._playgroundsExplorer = new PlaygroundsExplorer();
    this._playgroundController = new PlaygroundController(
      context,
      this._connectionController,
      this._languageServerController,
      this._telemetryController
    );
    this._webviewController = new WebviewController(
      this._connectionController,
      this._telemetryController
    );
  }

  activate(): void {
    this._explorerController.activateConnectionsTreeView();
    this._helpExplorer.activateHelpTreeView(this._telemetryController);
    this._playgroundsExplorer.activatePlaygroundsTreeView();

    this._connectionController.loadSavedConnections();
    this._telemetryController.activateSegmentAnalytics();
    this._languageServerController.startLanguageServer();

    log.info('Registering commands...');

    // Register our extension's commands. These are the event handlers and
    // control the functionality of our extension.
    this.registerCommand('mdb.connect', () =>
      this._webviewController.showConnectForm(this._context)
    );
    this.registerCommand('mdb.connectWithURI', () =>
      this._connectionController.connectWithURI()
    );
    this.registerCommand('mdb.openOverviewPage', () =>
      this._webviewController.showOverviewPage(this._context)
    );

    this.registerCommand('mdb.disconnect', () =>
      this._connectionController.disconnect()
    );
    this.registerCommand('mdb.removeConnection', () =>
      this._connectionController.onRemoveMongoDBConnection()
    );

    this.registerCommand('mdb.openMongoDBShell', () =>
      launchMongoShell(this._connectionController)
    );
    this.registerCommand('mdb.treeViewOpenMongoDBShell', () =>
      launchMongoShell(this._connectionController)
    );

    this.registerCommand('mdb.createPlayground', () =>
      this._playgroundController.createPlayground()
    );
    this.registerCommand('mdb.createNewPlaygroundFromViewAction', () =>
      this._playgroundController.createPlayground()
    );
    this.registerCommand('mdb.createNewPlaygroundFromOverviewPage', () =>
      this._playgroundController.createPlayground()
    );
    this.registerCommand('mdb.createNewPlaygroundFromPlaygroundExplorer', () =>
      this._playgroundController.createPlayground()
    );
    this.registerCommand('mdb.runSelectedPlaygroundBlocks', () =>
      this._playgroundController.runSelectedPlaygroundBlocks()
    );
    this.registerCommand('mdb.runAllPlaygroundBlocks', () =>
      this._playgroundController.runAllPlaygroundBlocks()
    );
    this.registerCommand('mdb.runPlayground', () =>
      this._playgroundController.runAllOrSelectedPlaygroundBlocks()
    );
    this.registerCommand('mdb.changeActiveConnection', () =>
      this._connectionController.changeActiveConnection()
    );
    this.registerCommand('mdb.refreshPlaygrounds', () =>
      this._playgroundsExplorer.refresh()
    );

    this.registerCommand('mdb.startStreamLanguageServerLogs', () =>
      this._languageServerController.startStreamLanguageServerLogs()
    );

    this.registerEditorCommands();
    this.registerTreeViewCommands();

    log.info('Registered commands.');
  }

  registerCommand = (
    command: string,
    commandHandler: (...args: any[]) => Promise<boolean>
  ): void => {
    const commandHandlerWithTelemetry = (args: any[]) => {
      // Send metrics to Segment.
      this._telemetryController.trackCommandRun(command);

      return commandHandler(args);
    };

    this._context.subscriptions.push(
      vscode.commands.registerCommand(command, commandHandlerWithTelemetry)
    );
  };

  registerEditorCommands(): void {
    this.registerCommand(
      'mdb.codeLens.showMoreDocumentsClicked',
      ({ operationId, connectionId, namespace }) => {
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
    this.registerCommand('mdb.refreshPlaygroundsFromTreeView', () =>
      this._playgroundsExplorer.refresh()
    );
    this.registerCommand(
      'mdb.openPlaygroundFromTreeItem',
      (playgroundsTreeItem: PlaygroundsTreeItem) =>
        this._playgroundController.openPlayground(playgroundsTreeItem.filePath)
    );
    this.registerCommand(
      'mdb.connectToConnectionTreeItem',
      (connectionTreeItem: ConnectionTreeItem) =>
        this._connectionController.connectWithConnectionId(
          connectionTreeItem.connectionId
        )
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
      async (element: ConnectionTreeItem): Promise<boolean> => {
        const connectionString = this._connectionController.getConnectionStringFromConnectionId(
          element.connectionId
        );

        await vscode.env.clipboard.writeText(connectionString);
        vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
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
          return false;
        }

        if (
          element.connectionId !==
          this._connectionController.getActiveConnectionId()
        ) {
          vscode.window.showErrorMessage(
            'Please connect to this connection before adding a database.'
          );
          return false;
        }

        if (this._connectionController.isDisconnecting()) {
          vscode.window.showErrorMessage(
            'Unable to add database: currently disconnecting.'
          );
          return false;
        }

        if (this._connectionController.isConnecting()) {
          vscode.window.showErrorMessage(
            'Unable to add database: currently connecting.'
          );
          return false;
        }

        const successfullyAddedDatabase = await element.onAddDatabaseClicked(
          this._context
        );

        if (successfullyAddedDatabase) {
          vscode.window.showInformationMessage(
            'Database and collection successfully created.'
          );

          // When we successfully added a database & collection, we need
          // to update the explorer view.
          this._explorerController.refresh();
        }
        return successfullyAddedDatabase;
      }
    );
    this.registerCommand(
      'mdb.searchForDocuments',
      (element: DocumentListTreeItem): Promise<boolean> =>
        this._playgroundController.createPlaygroundForSearch(
          element.databaseName,
          element.collectionName
        )
    );
    this.registerCommand(
      'mdb.copyDatabaseName',
      async (element: DatabaseTreeItem) => {
        await vscode.env.clipboard.writeText(element.databaseName);
        vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerCommand(
      'mdb.dropDatabase',
      async (element: DatabaseTreeItem): Promise<boolean> => {
        const successfullyDroppedDatabase = await element.onDropDatabaseClicked();

        if (successfullyDroppedDatabase) {
          vscode.window.showInformationMessage(
            'Database successfully dropped.'
          );

          // When we successfully drop a database, we need
          // to update the explorer view.
          this._explorerController.refresh();
        }

        return successfullyDroppedDatabase;
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
          return false;
        }

        const successfullyAddedCollection = await element.onAddCollectionClicked(
          this._context
        );
        if (successfullyAddedCollection) {
          vscode.window.showInformationMessage(
            'Collection successfully created.'
          );

          // When we successfully added a collection, we need
          // to update the explorer view.
          this._explorerController.refresh();
        }
        return true;
      }
    );
    this.registerCommand(
      'mdb.copyCollectionName',
      async (element: CollectionTreeItem): Promise<boolean> => {
        await vscode.env.clipboard.writeText(element.collectionName);
        vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerCommand(
      'mdb.dropCollection',
      async (element: CollectionTreeItem): Promise<boolean> => {
        const successfullyDroppedCollection = await element.onDropCollectionClicked();

        if (successfullyDroppedCollection) {
          vscode.window.showInformationMessage(
            'Collection successfully dropped.'
          );

          // When we successfully drop a collection, we need
          // to update the explorer view.
          this._explorerController.refresh();
        }

        return successfullyDroppedCollection;
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
      (
        element: CollectionTreeItem | DocumentListTreeItem
      ): Promise<boolean> => {
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
      'mdb.refreshDocumentList',
      (documentsListTreeItem: DocumentListTreeItem): Promise<boolean> => {
        documentsListTreeItem.resetCache();
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
    this.registerCommand(
      'mdb.copySchemaFieldName',
      async (fieldTreeItem: FieldTreeItem): Promise<boolean> => {
        await vscode.env.clipboard.writeText(fieldTreeItem.getFieldName());
        vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerCommand(
      'mdb.refreshIndexes',
      (indexListTreeItem: IndexListTreeItem): Promise<boolean> => {
        indexListTreeItem.resetCache();
        return this._explorerController.refresh();
      }
    );
    this.registerCommand(
      'mdb.createIndexFromTreeView',
      (indexListTreeItem: IndexListTreeItem): Promise<boolean> => {
        return this._playgroundController.createPlaygroundForNewIndex(
          indexListTreeItem.databaseName,
          indexListTreeItem.collectionName
        );
      }
    );
  }

  dispose(): void {
    this.deactivate();
  }

  public deactivate(): void {
    // TODO: Cancel active queries/playgrounds.
    this._connectionController.disconnect();
    this._explorerController.deactivate();
    this._helpExplorer.deactivate();
    this._playgroundsExplorer.deactivate();
    this._playgroundController.deactivate();
    this._telemetryController.deactivate();
    this._languageServerController.deactivate();
  }
}
