/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';

import ActiveConnectionCodeLensProvider from './editors/activeConnectionCodeLensProvider';
import ConnectionController from './connectionController';
import ConnectionTreeItem from './explorer/connectionTreeItem';
import { createLogger } from './logging';
import DatabaseTreeItem from './explorer/databaseTreeItem';
import DocumentListTreeItem from './explorer/documentListTreeItem';
import { DocumentSource } from './documentSource';
import DocumentTreeItem from './explorer/documentTreeItem';
import EditDocumentCodeLensProvider from './editors/editDocumentCodeLensProvider';
import { EditorsController, PlaygroundController } from './editors';
import type { EditDocumentInfo } from './types/editDocumentInfoType';
import {
  ExplorerController,
  PlaygroundsExplorer,
  HelpExplorer,
  CollectionTreeItem
} from './explorer';
import EXTENSION_COMMANDS from './commands';
import FieldTreeItem from './explorer/fieldTreeItem';
import IndexListTreeItem from './explorer/indexListTreeItem';
import { LanguageServerController } from './language';
import launchMongoShell from './commands/launchMongoShell';
import SchemaTreeItem from './explorer/schemaTreeItem';
import { StatusView } from './views';
import { StorageController, StorageVariables } from './storage';
import TelemetryService from './telemetry/telemetryService';
import PartialExecutionCodeLensProvider from './editors/partialExecutionCodeLensProvider';
import PlaygroundsTreeItem from './explorer/playgroundsTreeItem';
import PlaygroundResultProvider from './editors/playgroundResultProvider';
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
  _helpExplorer: HelpExplorer;
  _playgroundsExplorer: PlaygroundsExplorer;
  _statusView: StatusView;
  _storageController: StorageController;
  _telemetryService: TelemetryService;
  _languageServerController: LanguageServerController;
  _webviewController: WebviewController;
  _playgroundResultViewProvider: PlaygroundResultProvider;
  _activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
  _partialExecutionCodeLensProvider: PartialExecutionCodeLensProvider;
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;

  constructor(
    context: vscode.ExtensionContext,
    options: { shouldTrackTelemetry: boolean }
  ) {
    this._context = context;
    this._statusView = new StatusView(context);
    this._storageController = new StorageController(context);
    this._telemetryService = new TelemetryService(
      this._storageController,
      context,
      options.shouldTrackTelemetry
    );
    this._connectionController = new ConnectionController(
      this._statusView,
      this._storageController,
      this._telemetryService
    );
    this._languageServerController = new LanguageServerController(context);
    this._explorerController = new ExplorerController(
      this._connectionController
    );
    this._helpExplorer = new HelpExplorer();
    this._playgroundsExplorer = new PlaygroundsExplorer();
    this._editDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
      this._connectionController
    );
    this._playgroundResultViewProvider = new PlaygroundResultProvider(
      this._connectionController,
      this._editDocumentCodeLensProvider
    );
    this._activeConnectionCodeLensProvider = new ActiveConnectionCodeLensProvider(
      this._connectionController
    );
    this._partialExecutionCodeLensProvider = new PartialExecutionCodeLensProvider();
    this._playgroundController = new PlaygroundController(
      context,
      this._connectionController,
      this._languageServerController,
      this._telemetryService,
      this._statusView,
      this._playgroundResultViewProvider,
      this._activeConnectionCodeLensProvider,
      this._partialExecutionCodeLensProvider,
      this._explorerController
    );
    this._editorsController = new EditorsController(
      context,
      this._connectionController,
      this._playgroundController,
      this._statusView,
      this._telemetryService,
      this._playgroundResultViewProvider,
      this._activeConnectionCodeLensProvider,
      this._partialExecutionCodeLensProvider,
      this._editDocumentCodeLensProvider
    );
    this._webviewController = new WebviewController(
      this._connectionController,
      this._storageController,
      this._telemetryService
    );
    this._editorsController.registerProviders();
  }

  async activate(): Promise<void> {
    this._explorerController.activateConnectionsTreeView();
    this._helpExplorer.activateHelpTreeView(this._telemetryService);
    this._playgroundsExplorer.activatePlaygroundsTreeView();
    this._telemetryService.activateSegmentAnalytics();

    await this._connectionController.loadSavedConnections();
    await this._languageServerController.startLanguageServer();

    this.registerCommands();

    this.showOverviewPageIfRecentlyInstalled();
  }

  registerCommands = (): void => {
    log.info('Registering commands...');

    // Register our extension's commands. These are the event handlers and
    // control the functionality of our extension.
    this.registerCommand(EXTENSION_COMMANDS.MDB_CONNECT, () =>
      this._webviewController.openWebview(this._context)
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_CONNECT_WITH_URI, () =>
      this._connectionController.connectWithURI()
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_OPEN_OVERVIEW_PAGE, () =>
      this._webviewController.openWebview(this._context)
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_DISCONNECT, () =>
      this._connectionController.disconnect()
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_REMOVE_CONNECTION, () =>
      this._connectionController.onRemoveMongoDBConnection()
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_CHANGE_ACTIVE_CONNECTION, () =>
      this._connectionController.changeActiveConnection()
    );

    this.registerCommand(EXTENSION_COMMANDS.MDB_OPEN_MDB_SHELL, () =>
      launchMongoShell(this._connectionController)
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_OPEN_MDB_SHELL_FROM_TREE_VIEW,
      () => launchMongoShell(this._connectionController)
    );

    this.registerCommand(EXTENSION_COMMANDS.MDB_CREATE_PLAYGROUND, () =>
      this._playgroundController.createPlayground()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CREATE_PLAYGROUND_FROM_OVERVIEW_PAGE,
      () => this._playgroundController.createPlayground()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
      () => this._playgroundController.runSelectedPlaygroundBlocks()
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_RUN_ALL_PLAYGROUND_BLOCKS, () =>
      this._playgroundController.runAllPlaygroundBlocks()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_RUN_ALL_OR_SELECTED_PLAYGROUND_BLOCKS,
      () => this._playgroundController.runAllOrSelectedPlaygroundBlocks()
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_REFRESH_PLAYGROUNDS, () =>
      this._playgroundsExplorer.refresh()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_OPEN_MONGODB_DOCUMENT_FROM_CODE_LENS,
      (data: EditDocumentInfo) => {
        this._telemetryService.trackDocumentOpenedInEditor(data.source);

        return this._editorsController.openMongoDBDocument(data);
      }
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_SAVE_MONGODB_DOCUMENT, () =>
      this._editorsController.saveMongoDBDocument()
    );

    this.registerCommand(
      EXTENSION_COMMANDS.MDB_START_LANGUAGE_STREAM_LOGS,
      () => this._languageServerController.startStreamLanguageServerLogs()
    );

    this.registerEditorCommands();
    this.registerTreeViewCommands();

    log.info('Registered commands.');
  };

  registerCommand = (
    command: string,
    commandHandler: (...args: any[]) => Promise<boolean>
  ): void => {
    const commandHandlerWithTelemetry = (args: any[]): Promise<boolean> => {
      this._telemetryService.trackCommandRun(command);

      return commandHandler(args);
    };

    this._context.subscriptions.push(
      vscode.commands.registerCommand(command, commandHandlerWithTelemetry)
    );
  };

  registerEditorCommands(): void {
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CODELENS_SHOW_MORE_DOCUMENTS,
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
    this.registerCommand(EXTENSION_COMMANDS.MDB_ADD_CONNECTION, () =>
      this._webviewController.openWebview(this._context)
    );
    this.registerCommand(EXTENSION_COMMANDS.MDB_ADD_CONNECTION_WITH_URI, () =>
      this._connectionController.connectWithURI()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CONNECT_TO_CONNECTION_TREE_VIEW,
      (connectionTreeItem: ConnectionTreeItem) =>
        this._connectionController.connectWithConnectionId(
          connectionTreeItem.connectionId
        )
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_DISCONNECT_FROM_CONNECTION_TREE_VIEW,
      () => {
        // In order for this command to be activated, the connection must
        // be the active connection, so we can just generally disconnect.
        return this._connectionController.disconnect();
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REFRESH_CONNECTION,
      (connectionTreeItem: ConnectionTreeItem): Promise<boolean> => {
        connectionTreeItem.resetCache();
        this._explorerController.refresh();

        return Promise.resolve(true);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_COPY_CONNECTION_STRING,
      async (element: ConnectionTreeItem): Promise<boolean> => {
        const connectionString = this._connectionController.getConnectionStringFromConnectionId(
          element.connectionId
        );

        await vscode.env.clipboard.writeText(connectionString);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REMOVE_CONNECTION_TREE_VIEW,
      (element: ConnectionTreeItem) =>
        this._connectionController.removeMongoDBConnection(element.connectionId)
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_RENAME_CONNECTION,
      (element: ConnectionTreeItem) =>
        this._connectionController.renameConnection(element.connectionId)
    );

    this.registerCommand(
      EXTENSION_COMMANDS.MDB_ADD_DATABASE,
      async (element: ConnectionTreeItem): Promise<boolean> => {
        if (!element) {
          void vscode.window.showErrorMessage(
            'Please wait for the connection to finish loading before adding a database.'
          );

          return false;
        }

        if (
          element.connectionId !==
          this._connectionController.getActiveConnectionId()
        ) {
          void vscode.window.showErrorMessage(
            'Please connect to this connection before adding a database.'
          );

          return false;
        }

        if (this._connectionController.isDisconnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add database: currently disconnecting.'
          );

          return false;
        }

        if (this._connectionController.isConnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add database: currently connecting.'
          );

          return false;
        }

        return this._playgroundController
          .createPlaygroundForCreateCollection(element);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_COPY_DATABASE_NAME,
      async (element: DatabaseTreeItem) => {
        await vscode.env.clipboard.writeText(element.databaseName);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_DROP_DATABASE,
      async (element: DatabaseTreeItem): Promise<boolean> => {
        const successfullyDroppedDatabase = await element.onDropDatabaseClicked();

        if (successfullyDroppedDatabase) {
          void vscode.window.showInformationMessage(
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
      EXTENSION_COMMANDS.MDB_REFRESH_DATABASE,
      (databaseTreeItem: DatabaseTreeItem): Promise<boolean> => {
        databaseTreeItem.resetCache();
        this._explorerController.refresh();

        return Promise.resolve(true);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_ADD_COLLECTION,
      async (element: DatabaseTreeItem): Promise<boolean> => {
        if (this._connectionController.isDisconnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add collection: currently disconnecting.'
          );

          return false;
        }

        return this._playgroundController
          .createPlaygroundForCreateCollection(element);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_COPY_COLLECTION_NAME,
      async (element: CollectionTreeItem): Promise<boolean> => {
        await vscode.env.clipboard.writeText(element.collectionName);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_DROP_COLLECTION,
      async (element: CollectionTreeItem): Promise<boolean> => {
        const successfullyDroppedCollection = await element.onDropCollectionClicked();

        if (successfullyDroppedCollection) {
          void vscode.window.showInformationMessage(
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
      EXTENSION_COMMANDS.MDB_VIEW_COLLECTION_DOCUMENTS,
      (
        element: CollectionTreeItem | DocumentListTreeItem
      ): Promise<boolean> => {
        const namespace = `${element.databaseName}.${element.collectionName}`;

        return this._editorsController.onViewCollectionDocuments(namespace);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REFRESH_COLLECTION,
      (collectionTreeItem: CollectionTreeItem): Promise<boolean> => {
        collectionTreeItem.resetCache();
        this._explorerController.refresh();

        return Promise.resolve(true);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_SEARCH_FOR_DOCUMENTS,
      (element: DocumentListTreeItem): Promise<boolean> =>
        this._playgroundController.createPlaygroundForSearch(
          element.databaseName,
          element.collectionName
        )
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_OPEN_MONGODB_DOCUMENT_FROM_TREE,
      (element: DocumentTreeItem): Promise<boolean> => {
        return this._editorsController.openMongoDBDocument({
          source: DocumentSource.DOCUMENT_SOURCE_TREEVIEW,
          documentId: element.documentId,
          namespace: element.namespace,
          connectionId: this._connectionController.getActiveConnectionId(),
          line: 1
        });
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REFRESH_DOCUMENT_LIST,
      async (documentsListTreeItem: DocumentListTreeItem): Promise<boolean> => {
        await documentsListTreeItem.resetCache();
        this._explorerController.refresh();

        return Promise.resolve(true);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REFRESH_SCHEMA,
      (schemaTreeItem: SchemaTreeItem): Promise<boolean> => {
        schemaTreeItem.resetCache();
        this._explorerController.refresh();

        return Promise.resolve(true);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_COPY_SCHEMA_FIELD_NAME,
      async (fieldTreeItem: FieldTreeItem): Promise<boolean> => {
        await vscode.env.clipboard.writeText(fieldTreeItem.getFieldName());
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REFRESH_INDEXES,
      (indexListTreeItem: IndexListTreeItem): Promise<boolean> => {
        indexListTreeItem.resetCache();
        this._explorerController.refresh();

        return Promise.resolve(true);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CREATE_INDEX_TREE_VIEW,
      (indexListTreeItem: IndexListTreeItem): Promise<boolean> => {
        return this._playgroundController.createPlaygroundForNewIndex(
          indexListTreeItem.databaseName,
          indexListTreeItem.collectionName
        );
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CREATE_PLAYGROUND_FROM_VIEW_ACTION,
      () => this._playgroundController.createPlayground()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CREATE_PLAYGROUND_FROM_PLAYGROUND_EXPLORER,
      () => this._playgroundController.createPlayground()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REFRESH_PLAYGROUNDS_FROM_TREE_VIEW,
      () => this._playgroundsExplorer.refresh()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_OPEN_PLAYGROUND_FROM_TREE_VIEW,
      (playgroundsTreeItem: PlaygroundsTreeItem) =>
        this._playgroundController.openPlayground(playgroundsTreeItem.filePath)
    );
  }

  showOverviewPageIfRecentlyInstalled(): void {
    const hasBeenShownViewAlready = !!this._storageController.get(
      StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW
    );

    // Show the overview page when it hasn't been show to the
    // user yet, and they have no saved connections.
    if (!hasBeenShownViewAlready) {
      if (!this._storageController.hasSavedConnections()) {
        void vscode.commands.executeCommand(
          EXTENSION_COMMANDS.MDB_OPEN_OVERVIEW_PAGE
        );
      }

      void this._storageController.update(
        StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW,
        true
      );
    }
  }

  dispose(): void {
    void this.deactivate();
  }

  async deactivate(): Promise<void> {
    await this._connectionController.disconnect();

    this._explorerController.deactivate();
    this._helpExplorer.deactivate();
    this._playgroundsExplorer.deactivate();
    this._playgroundController.deactivate();
    this._telemetryService.deactivate();
    this._languageServerController.deactivate();
    this._editorsController.deactivate();
  }
}
