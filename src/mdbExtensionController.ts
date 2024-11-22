/**
 * Top-level controller for our extension.
 *
 * Activated from `./src/extension.ts`
 */
import * as vscode from 'vscode';

import ActiveConnectionCodeLensProvider from './editors/activeConnectionCodeLensProvider';
import PlaygroundSelectionCodeActionProvider from './editors/playgroundSelectionCodeActionProvider';
import PlaygroundDiagnosticsCodeActionProvider from './editors/playgroundDiagnosticsCodeActionProvider';
import ConnectionController from './connectionController';
import type ConnectionTreeItem from './explorer/connectionTreeItem';
import type DatabaseTreeItem from './explorer/databaseTreeItem';
import type DocumentListTreeItem from './explorer/documentListTreeItem';
import { DocumentSource } from './documentSource';
import type DocumentTreeItem from './explorer/documentTreeItem';
import EditDocumentCodeLensProvider from './editors/editDocumentCodeLensProvider';
import { EditorsController, PlaygroundController } from './editors';
import type { EditDocumentInfo } from './types/editDocumentInfoType';
import type { CollectionTreeItem } from './explorer';
import {
  ExplorerController,
  PlaygroundsExplorer,
  HelpExplorer,
} from './explorer';
import ExportToLanguageCodeLensProvider from './editors/exportToLanguageCodeLensProvider';
import { type ExportToLanguageResult } from './types/playgroundType';
import EXTENSION_COMMANDS from './commands';
import type FieldTreeItem from './explorer/fieldTreeItem';
import type IndexListTreeItem from './explorer/indexListTreeItem';
import { LanguageServerController } from './language';
import launchMongoShell from './commands/launchMongoShell';
import type SchemaTreeItem from './explorer/schemaTreeItem';
import { StatusView } from './views';
import { StorageController, StorageVariables } from './storage';
import TelemetryService, {
  TelemetryEventTypes,
} from './telemetry/telemetryService';
import type PlaygroundsTreeItem from './explorer/playgroundsTreeItem';
import PlaygroundResultProvider from './editors/playgroundResultProvider';
import WebviewController from './views/webviewController';
import { createIdFactory, generateId } from './utils/objectIdHelper';
import { ConnectionStorage } from './storage/connectionStorage';
import type StreamProcessorTreeItem from './explorer/streamProcessorTreeItem';
import type {
  ParticipantCommand,
  RunParticipantCodeCommandArgs,
} from './participant/participant';
import ParticipantController from './participant/participant';
import type { OpenSchemaCommandArgs } from './participant/prompts/schema';

// This class is the top-level controller for our extension.
// Commands which the extensions handles are defined in the function `activate`.
export default class MDBExtensionController implements vscode.Disposable {
  _playgroundSelectionCodeActionProvider: PlaygroundSelectionCodeActionProvider;
  _playgroundDiagnosticsCodeActionProvider: PlaygroundDiagnosticsCodeActionProvider;
  _connectionController: ConnectionController;
  _connectionStorage: ConnectionStorage;
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
  _playgroundResultProvider: PlaygroundResultProvider;
  _activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  _exportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;
  _participantController: ParticipantController;
  _startupNotificationShown = false;

  constructor(
    context: vscode.ExtensionContext,
    options: { shouldTrackTelemetry: boolean }
  ) {
    this._context = context;
    this._statusView = new StatusView(context);
    this._storageController = new StorageController(context);
    this._connectionStorage = new ConnectionStorage({
      storageController: this._storageController,
    });
    this._telemetryService = new TelemetryService(
      this._storageController,
      context,
      options.shouldTrackTelemetry
    );
    this._connectionController = new ConnectionController({
      statusView: this._statusView,
      storageController: this._storageController,
      telemetryService: this._telemetryService,
    });
    this._languageServerController = new LanguageServerController(context);
    this._explorerController = new ExplorerController(
      this._connectionController
    );
    this._helpExplorer = new HelpExplorer();
    this._playgroundsExplorer = new PlaygroundsExplorer();
    this._editDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
      this._connectionController
    );
    this._playgroundResultProvider = new PlaygroundResultProvider(
      this._connectionController,
      this._editDocumentCodeLensProvider
    );
    this._activeConnectionCodeLensProvider =
      new ActiveConnectionCodeLensProvider(this._connectionController);
    this._exportToLanguageCodeLensProvider =
      new ExportToLanguageCodeLensProvider(this._playgroundResultProvider);
    this._playgroundSelectionCodeActionProvider =
      new PlaygroundSelectionCodeActionProvider();
    this._playgroundDiagnosticsCodeActionProvider =
      new PlaygroundDiagnosticsCodeActionProvider();
    this._playgroundController = new PlaygroundController({
      connectionController: this._connectionController,
      languageServerController: this._languageServerController,
      telemetryService: this._telemetryService,
      statusView: this._statusView,
      playgroundResultProvider: this._playgroundResultProvider,
      playgroundSelectionCodeActionProvider:
        this._playgroundSelectionCodeActionProvider,
      exportToLanguageCodeLensProvider: this._exportToLanguageCodeLensProvider,
    });
    this._participantController = new ParticipantController({
      connectionController: this._connectionController,
      storageController: this._storageController,
      telemetryService: this._telemetryService,
      playgroundResultProvider: this._playgroundResultProvider,
    });
    this._editorsController = new EditorsController({
      context,
      connectionController: this._connectionController,
      playgroundController: this._playgroundController,
      statusView: this._statusView,
      telemetryService: this._telemetryService,
      playgroundResultProvider: this._playgroundResultProvider,
      activeConnectionCodeLensProvider: this._activeConnectionCodeLensProvider,
      exportToLanguageCodeLensProvider: this._exportToLanguageCodeLensProvider,
      playgroundSelectionCodeActionProvider:
        this._playgroundSelectionCodeActionProvider,
      playgroundDiagnosticsCodeActionProvider:
        this._playgroundDiagnosticsCodeActionProvider,
      editDocumentCodeLensProvider: this._editDocumentCodeLensProvider,
    });
    this._webviewController = new WebviewController({
      connectionController: this._connectionController,
      storageController: this._storageController,
      telemetryService: this._telemetryService,
    });
    this._editorsController.registerProviders();
  }

  async activate(): Promise<void> {
    this._explorerController.activateConnectionsTreeView();
    this._helpExplorer.activateHelpTreeView(this._telemetryService);
    this._playgroundsExplorer.activatePlaygroundsTreeView();
    this._telemetryService.activateSegmentAnalytics();
    this._participantController.createParticipant(this._context);

    await this._connectionController.loadSavedConnections();
    await this._languageServerController.startLanguageServer();

    this.registerCommands();
    this.showOverviewPageIfRecentlyInstalled();
    void this.showSurveyForEstablishedUsers();
    void this.showCopilotIntroductionForEstablishedUsers();
  }

  registerCommands = (): void => {
    // Register our extension's commands. These are the event handlers and
    // control the functionality of our extension.
    // ------ CONNECTION ------ //
    this.registerCommand(EXTENSION_COMMANDS.MDB_OPEN_OVERVIEW_PAGE, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(EXTENSION_COMMANDS.MDB_CONNECT, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(EXTENSION_COMMANDS.MDB_CONNECT_WITH_URI, () =>
      this._connectionController.connectWithURI()
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

    this.registerCommand(
      EXTENSION_COMMANDS.OPEN_MONGODB_ISSUE_REPORTER,
      async () => {
        return await vscode.commands.executeCommand(
          'workbench.action.openIssueReporter',
          {
            extensionId: 'mongodb.mongodb-vscode',
            issueSource: 'extension',
          }
        );
      }
    );

    // ------ SHELL ------ //
    this.registerCommand(EXTENSION_COMMANDS.MDB_OPEN_MDB_SHELL, () =>
      launchMongoShell(this._connectionController)
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_OPEN_MDB_SHELL_FROM_TREE_VIEW,
      () => launchMongoShell(this._connectionController)
    );

    // ------ PLAYGROUND ------ //
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
    this.registerCommand(EXTENSION_COMMANDS.MDB_EXPORT_CODE_TO_PLAYGROUND, () =>
      this._participantController.exportCodeToPlayground()
    );

    this.registerCommand(
      EXTENSION_COMMANDS.MDB_FIX_THIS_INVALID_INTERACTIVE_SYNTAX,
      (data) => this._playgroundController.fixThisInvalidInteractiveSyntax(data)
    );

    this.registerCommand(
      EXTENSION_COMMANDS.MDB_FIX_ALL_INVALID_INTERACTIVE_SYNTAX,
      (data) => this._playgroundController.fixAllInvalidInteractiveSyntax(data)
    );

    // ------ EXPORT TO LANGUAGE ------ //
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_SELECT_TARGET_FOR_EXPORT_TO_LANGUAGE,
      () => this._participantController.selectTargetForExportToLanguage()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_EXPORT_TO_LANGUAGE,
      (language: string) =>
        this._participantController.exportPlaygroundToLanguage(language)
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CHANGE_DRIVER_SYNTAX_FOR_EXPORT_TO_LANGUAGE,
      (includeDriverSyntax: boolean) =>
        this._participantController.changeDriverSyntaxForExportToLanguage(
          includeDriverSyntax
        )
    );
    this.registerParticipantCommand(
      EXTENSION_COMMANDS.SHOW_EXPORT_TO_LANGUAGE_RESULT,
      (data: ExportToLanguageResult) => {
        return this._playgroundController.showExportToLanguageResult(data);
      }
    );

    // ------ DOCUMENTS ------ //
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

    this.registerEditorCommands();
    this.registerTreeViewCommands();

    // ------ CHAT PARTICIPANT ------ //
    this.registerParticipantCommand(
      EXTENSION_COMMANDS.OPEN_PARTICIPANT_CODE_IN_PLAYGROUND,
      ({ runnableContent }: RunParticipantCodeCommandArgs) => {
        return this._playgroundController.createPlaygroundFromParticipantCode({
          text: runnableContent,
        });
      }
    );
    this.registerParticipantCommand(
      EXTENSION_COMMANDS.RUN_PARTICIPANT_CODE,
      ({ runnableContent }: RunParticipantCodeCommandArgs) => {
        return this._playgroundController.evaluateParticipantCode(
          runnableContent
        );
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.CONNECT_WITH_PARTICIPANT,
      (data: { id?: string; command?: string }) => {
        return this._participantController.connectWithParticipant(data);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.SELECT_DATABASE_WITH_PARTICIPANT,
      (data: {
        chatId: string;
        command: ParticipantCommand;
        databaseName?: string;
      }) => {
        return this._participantController.selectDatabaseWithParticipant(data);
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.SELECT_COLLECTION_WITH_PARTICIPANT,
      (data: any) => {
        return this._participantController.selectCollectionWithParticipant(
          data
        );
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.PARTICIPANT_OPEN_RAW_SCHEMA_OUTPUT,
      async ({ schema }: OpenSchemaCommandArgs) => {
        const document = await vscode.workspace.openTextDocument({
          language: 'json',
          content: schema,
        });
        await vscode.window.showTextDocument(document, { preview: true });

        return !!document;
      }
    );
  };

  registerParticipantCommand = (
    command: string,
    commandHandler: (...args: any[]) => Promise<boolean>
  ): void => {
    const commandHandlerWithTelemetry = (args: any[]): Promise<boolean> => {
      this._telemetryService.trackCommandRun(command);

      return commandHandler(args);
    };
    const participant = this._participantController.getParticipant();
    if (participant) {
      this._context.subscriptions.push(
        participant,
        vscode.commands.registerCommand(command, commandHandlerWithTelemetry)
      );
    }
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
    this.registerCommand(EXTENSION_COMMANDS.MDB_ADD_CONNECTION, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(EXTENSION_COMMANDS.MDB_ADD_CONNECTION_WITH_URI, () =>
      this._connectionController.connectWithURI()
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CONNECT_TO_CONNECTION_TREE_VIEW,
      async (connectionTreeItem: ConnectionTreeItem) => {
        const { successfullyConnected } =
          await this._connectionController.connectWithConnectionId(
            connectionTreeItem.connectionId
          );
        return successfullyConnected;
      }
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
      async (connectionTreeItem: ConnectionTreeItem): Promise<boolean> => {
        connectionTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({
          databases: true,
          collections: true,
          fields: true,
          streamProcessors: true,
        });

        return true;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_COPY_CONNECTION_STRING,
      async (element: ConnectionTreeItem): Promise<boolean> => {
        const connectionString =
          this._connectionController.copyConnectionStringByConnectionId(
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
      EXTENSION_COMMANDS.MDB_EDIT_CONNECTION,
      (element: ConnectionTreeItem) => {
        const connectionOptions =
          this._connectionController.getConnectionConnectionOptions(
            element.connectionId
          );

        if (!connectionOptions) {
          return Promise.resolve(false);
        }

        void this._webviewController.openEditConnection({
          connection: {
            id: element.connectionId,
            name: this._connectionController.getSavedConnectionName(
              element.connectionId
            ),
            connectionOptions,
          },
          context: this._context,
        });
        return Promise.resolve(true);
      }
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

        return this._playgroundController.createPlaygroundForCreateCollection(
          element
        );
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
        const successfullyDroppedDatabase =
          await element.onDropDatabaseClicked();

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
      async (databaseTreeItem: DatabaseTreeItem): Promise<boolean> => {
        databaseTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({
          collections: true,
          fields: true,
        });

        return true;
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

        return this._playgroundController.createPlaygroundForCreateCollection(
          element
        );
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
        const successfullyDroppedCollection =
          await element.onDropCollectionClicked();

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
      async (collectionTreeItem: CollectionTreeItem): Promise<boolean> => {
        collectionTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
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
          line: 1,
        });
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REFRESH_DOCUMENT_LIST,
      async (documentsListTreeItem: DocumentListTreeItem): Promise<boolean> => {
        await documentsListTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_INSERT_DOCUMENT_FROM_TREE_VIEW,
      async (
        documentsListTreeItem: DocumentListTreeItem | CollectionTreeItem
      ): Promise<boolean> => {
        return this._playgroundController.createPlaygroundForInsertDocument(
          documentsListTreeItem.databaseName,
          documentsListTreeItem.collectionName
        );
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_REFRESH_SCHEMA,
      async (schemaTreeItem: SchemaTreeItem): Promise<boolean> => {
        schemaTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
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
      EXTENSION_COMMANDS.MDB_CREATE_PLAYGROUND_FROM_TREE_VIEW,
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
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_COPY_DOCUMENT_CONTENTS_FROM_TREE_VIEW,
      async (documentTreeItem: DocumentTreeItem): Promise<boolean> => {
        const documentContents =
          await documentTreeItem.getStringifiedEJSONDocumentContents();
        await vscode.env.clipboard.writeText(documentContents);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_CLONE_DOCUMENT_FROM_TREE_VIEW,
      async (documentTreeItem: DocumentTreeItem): Promise<boolean> => {
        const documentContents =
          await documentTreeItem.getJSStringDocumentContents();

        const [databaseName, collectionName] =
          documentTreeItem.namespace.split(/\.(.*)/s);

        return this._playgroundController.createPlaygroundForCloneDocument(
          documentContents,
          databaseName,
          collectionName
        );
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_DELETE_DOCUMENT_FROM_TREE_VIEW,
      async (documentTreeItem: DocumentTreeItem): Promise<boolean> => {
        const successfullyDropped =
          await documentTreeItem.onDeleteDocumentClicked();

        if (successfullyDropped) {
          void vscode.window.showInformationMessage(
            'Document successfully deleted.'
          );

          // When we successfully drop a document, we need
          // to update the explorer view.
          this._explorerController.refresh();
        }

        return successfullyDropped;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_INSERT_OBJECTID_TO_EDITOR,
      async (): Promise<boolean> => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          void vscode.window.showInformationMessage(
            'No active editor to insert to.'
          );
          return false;
        }

        const objectIdFactory = createIdFactory();

        await editor.edit((editBuilder) => {
          const { selections } = editor;

          for (const selection of selections) {
            editBuilder.replace(selection, objectIdFactory().toHexString());
          }
        });
        return true;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_GENERATE_OBJECTID_TO_CLIPBOARD,
      async (): Promise<boolean> => {
        await vscode.env.clipboard.writeText(generateId().toHexString());
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      }
    );
    this.registerAtlasStreamsTreeViewCommands();
  }

  registerAtlasStreamsTreeViewCommands(): void {
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_ADD_STREAM_PROCESSOR,
      async (element: ConnectionTreeItem): Promise<boolean> => {
        if (!element) {
          void vscode.window.showErrorMessage(
            'Please wait for the connection to finish loading before adding a stream processor.'
          );

          return false;
        }

        if (
          element.connectionId !==
          this._connectionController.getActiveConnectionId()
        ) {
          void vscode.window.showErrorMessage(
            'Please connect to this connection before adding a stream processor.'
          );

          return false;
        }

        if (this._connectionController.isDisconnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add stream processor: currently disconnecting.'
          );

          return false;
        }

        if (this._connectionController.isConnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add stream processor: currently connecting.'
          );

          return false;
        }

        return this._playgroundController.createPlaygroundForCreateStreamProcessor(
          element
        );
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_START_STREAM_PROCESSOR,
      async (element: StreamProcessorTreeItem): Promise<boolean> => {
        const started = await element.onStartClicked();
        if (started) {
          void vscode.window.showInformationMessage(
            'Stream processor successfully started.'
          );
          // Refresh explorer view after a processor is started.
          this._explorerController.refresh();
        }
        return started;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_STOP_STREAM_PROCESSOR,
      async (element: StreamProcessorTreeItem): Promise<boolean> => {
        const stopped = await element.onStopClicked();
        if (stopped) {
          void vscode.window.showInformationMessage(
            'Stream processor successfully stopped.'
          );
          // Refresh explorer view after a processor is stopped.
          this._explorerController.refresh();
        }
        return stopped;
      }
    );
    this.registerCommand(
      EXTENSION_COMMANDS.MDB_DROP_STREAM_PROCESSOR,
      async (element: StreamProcessorTreeItem): Promise<boolean> => {
        const dropped = await element.onDropClicked();
        if (dropped) {
          void vscode.window.showInformationMessage(
            'Stream processor successfully dropped.'
          );
          // Refresh explorer view after a processor is dropped.
          this._explorerController.refresh();
        }
        return dropped;
      }
    );
  }

  showOverviewPageIfRecentlyInstalled(): void {
    const hasBeenShownViewAlready = !!this._storageController.get(
      StorageVariables.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW
    );

    // Show the overview page when it hasn't been show to the
    // user yet, and they have no saved connections.
    if (!hasBeenShownViewAlready) {
      if (!this._connectionStorage.hasSavedConnections()) {
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

  async showCopilotIntroductionForEstablishedUsers(): Promise<void> {
    const copilotIntroductionShown =
      this._storageController.get(
        StorageVariables.GLOBAL_COPILOT_INTRODUCTION_SHOWN
      ) === true;

    // Show the toast when startup notifications have not been shown
    // to the user yet and they have saved connections
    // -> they haven't just started using this extension.
    if (
      this._startupNotificationShown ||
      copilotIntroductionShown ||
      !this._connectionStorage.hasSavedConnections()
    ) {
      return;
    }

    this._startupNotificationShown = true;

    const action = 'Chat with @MongoDB';
    const text =
      'Generate queries, interact with documentation, and explore your database schema using the MongoDB Copilot extension. Give it a try!';
    const result = await vscode.window.showInformationMessage(
      text,
      {},
      {
        title: action,
      }
    );

    const copilot = vscode.extensions.getExtension('github.copilot-chat');
    if (result?.title === action) {
      await vscode.commands.executeCommand('workbench.action.chat.newChat');
      await vscode.commands.executeCommand(
        'workbench.action.chat.clearHistory'
      );
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: '@MongoDB',
        isPartialQuery: true,
      });
      this._telemetryService.trackCopilotIntroductionClicked({
        is_copilot_active: !!copilot?.isActive,
      });
    } else {
      this._telemetryService.trackCopilotIntroductionDismissed({
        is_copilot_active: !!copilot?.isActive,
      });
    }

    // Whether action was taken or the prompt dismissed, we won't show this again.
    void this._storageController.update(
      StorageVariables.GLOBAL_COPILOT_INTRODUCTION_SHOWN,
      true
    );
  }

  async showSurveyForEstablishedUsers(): Promise<void> {
    const surveyId = '9viN9wcbsC3zvHyg7';

    const hasBeenShownSurveyAlready =
      this._storageController.get(StorageVariables.GLOBAL_SURVEY_SHOWN) ===
      surveyId;

    // Show the toast when startup notifications have not been shown
    // to the user yet and they have saved connections
    // -> they haven't just started using this extension
    if (
      this._startupNotificationShown ||
      hasBeenShownSurveyAlready ||
      !this._connectionStorage.hasSavedConnections()
    ) {
      return;
    }

    this._startupNotificationShown = true;

    const action = 'Share your thoughts';
    const text = 'How can we make the MongoDB extension better for you?';
    const link = 'https://forms.gle/9viN9wcbsC3zvHyg7';
    const result = await vscode.window.showInformationMessage(
      text,
      {},
      {
        title: action,
      }
    );
    if (result?.title === action) {
      void vscode.env.openExternal(vscode.Uri.parse(link));
      this._telemetryService.track(TelemetryEventTypes.SURVEY_CLICKED, {
        survey_id: surveyId,
      });
    } else {
      this._telemetryService.track(TelemetryEventTypes.SURVEY_DISMISSED, {
        survey_id: surveyId,
      });
    }

    // whether action was taken or the prompt dismissed, we won't show this again
    void this._storageController.update(
      StorageVariables.GLOBAL_SURVEY_SHOWN,
      surveyId
    );
  }

  async dispose(): Promise<void> {
    await this.deactivate();
  }

  async deactivate(): Promise<void> {
    await this._connectionController.disconnect();
    await this._languageServerController.deactivate();

    this._explorerController.deactivate();
    this._helpExplorer.deactivate();
    this._playgroundsExplorer.deactivate();
    this._playgroundController.deactivate();
    this._telemetryService.deactivate();
    this._editorsController.deactivate();
    this._webviewController.deactivate();
    this._activeConnectionCodeLensProvider.deactivate();
    this._connectionController.deactivate();
  }
}
