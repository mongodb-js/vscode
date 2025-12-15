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
import type FieldTreeItem from './explorer/fieldTreeItem';
import type IndexListTreeItem from './explorer/indexListTreeItem';
import { LanguageServerController } from './language';
import launchMongoShell from './commands/launchMongoShell';
import type SchemaTreeItem from './explorer/schemaTreeItem';
import { StatusView } from './views';
import { StorageController, StorageVariable } from './storage';
import { DeepLinkTelemetryEvent, TelemetryService } from './telemetry';
import type PlaygroundsTreeItem from './explorer/playgroundsTreeItem';
import PlaygroundResultProvider from './editors/playgroundResultProvider';
import WebviewController from './views/webviewController';
import { createIdFactory, generateId } from './utils/objectIdHelper';
import { ConnectionStorage } from './storage/connectionStorage';
import type StreamProcessorTreeItem from './explorer/streamProcessorTreeItem';
import type { RunParticipantCodeCommandArgs } from './participant/participant';
import ParticipantController from './participant/participant';
import type { OpenSchemaCommandArgs } from './participant/prompts/schema';
import { QueryWithCopilotCodeLensProvider } from './editors/queryWithCopilotCodeLensProvider';
import type {
  SendMessageToParticipantOptions,
  SendMessageToParticipantFromInputOptions,
  ParticipantCommand,
} from './participant/participantTypes';
import ExtensionCommand from './commands';
import { COPILOT_EXTENSION_ID } from './participant/constants';
import {
  CommandRunTelemetryEvent,
  DocumentEditedTelemetryEvent,
} from './telemetry';

import * as queryString from 'query-string';
import { MCPController } from './mcp/mcpController';

// Deep link command filtering: Commands are explicitly categorized as allowed or disallowed.
// We use tests in mdbExtensionController.test.ts to enforce these lists being disjoint and complete.
export const DEEP_LINK_ALLOWED_COMMANDS = [
  ExtensionCommand.MDB_CONNECT,
  ExtensionCommand.MDB_CONNECT_WITH_URI,
  ExtensionCommand.MDB_OPEN_OVERVIEW_PAGE,
  ExtensionCommand.MDB_DISCONNECT,
  ExtensionCommand.OPEN_MONGODB_ISSUE_REPORTER,
  ExtensionCommand.MDB_OPEN_MDB_SHELL,
  ExtensionCommand.MDB_CREATE_PLAYGROUND,
  ExtensionCommand.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
  ExtensionCommand.MDB_RUN_ALL_PLAYGROUND_BLOCKS,
  ExtensionCommand.MDB_RUN_ALL_OR_SELECTED_PLAYGROUND_BLOCKS,
  ExtensionCommand.MDB_EXPORT_CODE_TO_PLAYGROUND,
  ExtensionCommand.MDB_FIX_THIS_INVALID_INTERACTIVE_SYNTAX,
  ExtensionCommand.MDB_FIX_ALL_INVALID_INTERACTIVE_SYNTAX,
  ExtensionCommand.MDB_SELECT_TARGET_FOR_EXPORT_TO_LANGUAGE,
  ExtensionCommand.MDB_EXPORT_TO_LANGUAGE,
  ExtensionCommand.MDB_CHANGE_DRIVER_SYNTAX_FOR_EXPORT_TO_LANGUAGE,
  ExtensionCommand.MDB_SAVE_MONGODB_DOCUMENT,
  ExtensionCommand.MDB_CHANGE_ACTIVE_CONNECTION,
  ExtensionCommand.MDB_CODELENS_SHOW_MORE_DOCUMENTS,
  ExtensionCommand.MDB_ADD_CONNECTION,
  ExtensionCommand.MDB_ADD_CONNECTION_WITH_URI,
  ExtensionCommand.MDB_EDIT_CONNECTION,
  ExtensionCommand.MDB_REFRESH_CONNECTION,
  ExtensionCommand.MDB_COPY_CONNECTION_STRING,
  ExtensionCommand.MDB_EDIT_PRESET_CONNECTIONS,
  ExtensionCommand.MDB_RENAME_CONNECTION,
  ExtensionCommand.MDB_ADD_DATABASE,
  ExtensionCommand.MDB_SEARCH_FOR_DOCUMENTS,
  ExtensionCommand.MDB_COPY_DATABASE_NAME,
  ExtensionCommand.MDB_REFRESH_DATABASE,
  ExtensionCommand.MDB_ADD_COLLECTION,
  ExtensionCommand.MDB_COPY_COLLECTION_NAME,
  ExtensionCommand.MDB_VIEW_COLLECTION_DOCUMENTS,
  ExtensionCommand.MDB_REFRESH_COLLECTION,
  ExtensionCommand.MDB_REFRESH_DOCUMENT_LIST,

  ExtensionCommand.MDB_REFRESH_SCHEMA,
  ExtensionCommand.MDB_COPY_SCHEMA_FIELD_NAME,
  ExtensionCommand.MDB_REFRESH_INDEXES,
  ExtensionCommand.MDB_INSERT_OBJECTID_TO_EDITOR,
  ExtensionCommand.MDB_GENERATE_OBJECTID_TO_CLIPBOARD,

  ExtensionCommand.MDB_ADD_STREAM_PROCESSOR,
  ExtensionCommand.MDB_START_STREAM_PROCESSOR,
  ExtensionCommand.MDB_STOP_STREAM_PROCESSOR,

  ExtensionCommand.START_MCP_SERVER,
  ExtensionCommand.STOP_MCP_SERVER,
  ExtensionCommand.GET_MCP_SERVER_CONFIG,
] as const;

export const DEEP_LINK_DISALLOWED_COMMANDS = [
  // Participant commands - internal APIs designed for chat UI only
  ExtensionCommand.RUN_PARTICIPANT_CODE,
  ExtensionCommand.OPEN_PARTICIPANT_CODE_IN_PLAYGROUND,
  ExtensionCommand.CONNECT_WITH_PARTICIPANT,
  ExtensionCommand.SELECT_DATABASE_WITH_PARTICIPANT,
  ExtensionCommand.SELECT_COLLECTION_WITH_PARTICIPANT,
  ExtensionCommand.PARTICIPANT_OPEN_RAW_SCHEMA_OUTPUT,
  ExtensionCommand.SEND_MESSAGE_TO_PARTICIPANT,
  ExtensionCommand.SEND_MESSAGE_TO_PARTICIPANT_FROM_INPUT,
  ExtensionCommand.SHOW_EXPORT_TO_LANGUAGE_RESULT,
  // Destructive operations
  ExtensionCommand.MDB_DROP_DATABASE,
  ExtensionCommand.MDB_DROP_COLLECTION,
  ExtensionCommand.MDB_DROP_STREAM_PROCESSOR,
  ExtensionCommand.MDB_REMOVE_CONNECTION,

  // Location-specific items - not intended to be accessed in other ways
  ExtensionCommand.MDB_DELETE_DOCUMENT_FROM_TREE_VIEW,
  ExtensionCommand.MDB_REMOVE_CONNECTION_TREE_VIEW,
  ExtensionCommand.MDB_OPEN_MDB_SHELL_FROM_TREE_VIEW,
  ExtensionCommand.MDB_REFRESH_PLAYGROUNDS_FROM_TREE_VIEW,
  ExtensionCommand.MDB_OPEN_PLAYGROUND_FROM_TREE_VIEW,
  ExtensionCommand.MDB_CONNECT_TO_CONNECTION_TREE_VIEW,
  ExtensionCommand.MDB_CREATE_PLAYGROUND_FROM_TREE_VIEW,
  ExtensionCommand.MDB_CREATE_PLAYGROUND_FROM_TREE_ITEM,
  ExtensionCommand.MDB_DISCONNECT_FROM_CONNECTION_TREE_VIEW,
  ExtensionCommand.MDB_OPEN_MONGODB_DOCUMENT_FROM_TREE,
  ExtensionCommand.MDB_INSERT_DOCUMENT_FROM_TREE_VIEW,
  ExtensionCommand.MDB_COPY_DOCUMENT_CONTENTS_FROM_TREE_VIEW,
  ExtensionCommand.MDB_CLONE_DOCUMENT_FROM_TREE_VIEW,
  ExtensionCommand.ASK_COPILOT_FROM_TREE_ITEM,
  ExtensionCommand.MDB_CREATE_INDEX_TREE_VIEW,
  ExtensionCommand.MDB_OPEN_MONGODB_DOCUMENT_FROM_CODE_LENS,
  ExtensionCommand.MDB_CREATE_PLAYGROUND_FROM_OVERVIEW_PAGE,
] as const;

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
  _queryWithCopilotCodeLensProvider: QueryWithCopilotCodeLensProvider;
  _playgroundResultProvider: PlaygroundResultProvider;
  _activeConnectionCodeLensProvider: ActiveConnectionCodeLensProvider;
  _editDocumentCodeLensProvider: EditDocumentCodeLensProvider;
  _exportToLanguageCodeLensProvider: ExportToLanguageCodeLensProvider;
  _participantController: ParticipantController;
  _mcpController: MCPController;

  constructor(
    context: vscode.ExtensionContext,
    options: { shouldTrackTelemetry: boolean },
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
      options.shouldTrackTelemetry,
    );
    this._connectionController = new ConnectionController({
      statusView: this._statusView,
      storageController: this._storageController,
      telemetryService: this._telemetryService,
    });
    this._languageServerController = new LanguageServerController(context);
    this._explorerController = new ExplorerController(
      this._connectionController,
      this._telemetryService,
    );
    this._helpExplorer = new HelpExplorer(this._telemetryService);
    this._playgroundsExplorer = new PlaygroundsExplorer(this._telemetryService);
    this._editDocumentCodeLensProvider = new EditDocumentCodeLensProvider(
      this._connectionController,
    );
    this._playgroundResultProvider = new PlaygroundResultProvider(
      this._connectionController,
      this._editDocumentCodeLensProvider,
    );
    this._queryWithCopilotCodeLensProvider =
      new QueryWithCopilotCodeLensProvider();
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
      queryWithCopilotCodeLensProvider: this._queryWithCopilotCodeLensProvider,
    });
    this._webviewController = new WebviewController({
      connectionController: this._connectionController,
      storageController: this._storageController,
      telemetryService: this._telemetryService,
    });
    this._editorsController.registerProviders();
    this._mcpController = new MCPController({
      context,
      connectionController: this._connectionController,
      getTelemetryAnonymousId: (): string =>
        this._connectionStorage.getUserAnonymousId(),
    });
  }

  subscribeToConfigurationChanges(): void {
    const subscription = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('mdb.presetConnections')) {
        void this._connectionController.loadSavedConnections();
      }
    });
    this._context.subscriptions.push(subscription);
  }

  async activate(): Promise<void> {
    this._explorerController.activateConnectionsTreeView();
    this._helpExplorer.activateHelpTreeView();
    this._playgroundsExplorer.activatePlaygroundsTreeView();
    void this._telemetryService.activateSegmentAnalytics();
    this._participantController.createParticipant(this._context);

    await this._connectionController.loadSavedConnections();
    await this._languageServerController.startLanguageServer();
    await this._mcpController.activate();

    this.registerCommands();
    this.showOverviewPageIfRecentlyInstalled();
    this.subscribeToConfigurationChanges();
    this.registerUriHandler();

    const copilot = vscode.extensions.getExtension(COPILOT_EXTENSION_ID);
    void vscode.commands.executeCommand(
      'setContext',
      'mdb.isCopilotActive',
      copilot?.isActive,
    );

    // TODO: This is a workaround related to https://github.com/microsoft/vscode/issues/234426
    // If the extension was found but is not activated, there is a chance that the MongoDB extension
    // was activated before the Copilot one, so we check again after a delay.
    if (copilot && !copilot?.isActive) {
      setTimeout(() => {
        const copilot = vscode.extensions.getExtension(COPILOT_EXTENSION_ID);
        void vscode.commands.executeCommand(
          'setContext',
          'mdb.isCopilotActive',
          copilot?.isActive === true,
        );
      }, 3000);
    }
  }

  registerUriHandler = (): void => {
    vscode.window.registerUriHandler({
      handleUri: this._handleDeepLink,
    });
  };

  _handleDeepLink = async (uri: vscode.Uri): Promise<void> => {
    let command = uri.path.replace(/^\//, '');
    if (!command.startsWith('mdb.')) {
      command = `mdb.${command}`;
    }

    const parameters = queryString.parse(uri.query, {
      parseBooleans: true,
      parseNumbers: true,
    });

    const source =
      'utm_source' in parameters && typeof parameters.utm_source === 'string'
        ? parameters.utm_source
        : undefined;

    delete parameters.utm_source; // Don't propagate after tracking.
    this._telemetryService.track(new DeepLinkTelemetryEvent(command, source));

    try {
      if (
        !Object.values(ExtensionCommand).includes(command as ExtensionCommand)
      ) {
        throw new Error(
          `Unable to execute command '${command}' since it is not registered by the MongoDB extension.`,
        );
      }

      if (
        (DEEP_LINK_DISALLOWED_COMMANDS as readonly ExtensionCommand[]).includes(
          command as ExtensionCommand,
        )
      ) {
        throw new Error(
          `Command '${command}' cannot be invoked via deep links.`,
        );
      }

      await vscode.commands.executeCommand(command, parameters);
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Failed to handle '${uri}': ${error}`,
      );
    }
  };

  registerCommands = (): void => {
    // Register our extension's commands. These are the event handlers and
    // control the functionality of our extension.
    // ------ CONNECTION ------ //
    this.registerCommand(ExtensionCommand.MDB_OPEN_OVERVIEW_PAGE, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(ExtensionCommand.MDB_CONNECT, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(ExtensionCommand.MDB_CONNECT_WITH_URI, (params) => {
      return this._connectionController.connectWithURI(params);
    });
    this.registerCommand(ExtensionCommand.MDB_DISCONNECT, () =>
      this._connectionController.disconnect(),
    );
    this.registerCommand(ExtensionCommand.MDB_REMOVE_CONNECTION, (params) =>
      this._connectionController.onRemoveMongoDBConnection(params),
    );
    this.registerCommand(ExtensionCommand.MDB_CHANGE_ACTIVE_CONNECTION, () =>
      this._connectionController.changeActiveConnection(),
    );

    this.registerCommand(
      ExtensionCommand.OPEN_MONGODB_ISSUE_REPORTER,
      async () => {
        return await vscode.commands.executeCommand(
          'workbench.action.openIssueReporter',
          {
            extensionId: 'mongodb.mongodb-vscode',
            issueSource: 'extension',
          },
        );
      },
    );

    // ------ SHELL ------ //
    this.registerCommand(ExtensionCommand.MDB_OPEN_MDB_SHELL, () =>
      launchMongoShell(this._connectionController),
    );
    this.registerCommand(
      ExtensionCommand.MDB_OPEN_MDB_SHELL_FROM_TREE_VIEW,
      () => launchMongoShell(this._connectionController),
    );

    // ------ PLAYGROUND ------ //
    this.registerCommand(ExtensionCommand.MDB_CREATE_PLAYGROUND, () =>
      this._playgroundController.createPlayground(),
    );
    this.registerCommand(
      ExtensionCommand.MDB_CREATE_PLAYGROUND_FROM_OVERVIEW_PAGE,
      () => this._playgroundController.createPlayground(),
    );
    this.registerCommand(
      ExtensionCommand.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
      () => this._playgroundController.runSelectedPlaygroundBlocks(),
    );
    this.registerCommand(ExtensionCommand.MDB_RUN_ALL_PLAYGROUND_BLOCKS, () =>
      this._playgroundController.runAllPlaygroundBlocks(),
    );
    this.registerCommand(
      ExtensionCommand.MDB_RUN_ALL_OR_SELECTED_PLAYGROUND_BLOCKS,
      () => this._playgroundController.runAllOrSelectedPlaygroundBlocks(),
    );
    this.registerCommand(ExtensionCommand.MDB_EXPORT_CODE_TO_PLAYGROUND, () =>
      this._participantController.exportCodeToPlayground(),
    );

    this.registerCommand(
      ExtensionCommand.MDB_FIX_THIS_INVALID_INTERACTIVE_SYNTAX,
      (data) =>
        this._playgroundController.fixThisInvalidInteractiveSyntax(data),
    );

    this.registerCommand(
      ExtensionCommand.MDB_FIX_ALL_INVALID_INTERACTIVE_SYNTAX,
      (data) => this._playgroundController.fixAllInvalidInteractiveSyntax(data),
    );

    // ------ EXPORT TO LANGUAGE ------ //
    this.registerCommand(
      ExtensionCommand.MDB_SELECT_TARGET_FOR_EXPORT_TO_LANGUAGE,
      () => this._participantController.selectTargetForExportToLanguage(),
    );
    this.registerCommand(
      ExtensionCommand.MDB_EXPORT_TO_LANGUAGE,
      (language: string) =>
        this._participantController.exportPlaygroundToLanguage(language),
    );
    this.registerCommand(
      ExtensionCommand.MDB_CHANGE_DRIVER_SYNTAX_FOR_EXPORT_TO_LANGUAGE,
      (includeDriverSyntax: boolean) =>
        this._participantController.changeDriverSyntaxForExportToLanguage(
          includeDriverSyntax,
        ),
    );
    this.registerParticipantCommand(
      ExtensionCommand.SHOW_EXPORT_TO_LANGUAGE_RESULT,
      (data: ExportToLanguageResult) => {
        return this._playgroundController.showExportToLanguageResult(data);
      },
    );

    // ------ DOCUMENTS ------ //
    this.registerCommand(
      ExtensionCommand.MDB_OPEN_MONGODB_DOCUMENT_FROM_CODE_LENS,
      (data: EditDocumentInfo) => {
        this._telemetryService.track(
          new DocumentEditedTelemetryEvent(data.source),
        );

        return this._editorsController.openMongoDBDocument(data);
      },
    );
    this.registerCommand(ExtensionCommand.MDB_SAVE_MONGODB_DOCUMENT, () =>
      this._editorsController.saveMongoDBDocument(),
    );

    this.registerEditorCommands();
    this.registerTreeViewCommands();

    // ------ CHAT PARTICIPANT ------ //
    this.registerParticipantCommand(
      ExtensionCommand.OPEN_PARTICIPANT_CODE_IN_PLAYGROUND,
      ({ runnableContent }: RunParticipantCodeCommandArgs) => {
        return this._playgroundController.createPlaygroundFromParticipantCode({
          text: runnableContent,
        });
      },
    );
    this.registerParticipantCommand(
      ExtensionCommand.SEND_MESSAGE_TO_PARTICIPANT,
      async (options: SendMessageToParticipantOptions) => {
        await this._participantController.sendMessageToParticipant(options);
        return true;
      },
    );
    this.registerParticipantCommand(
      ExtensionCommand.SEND_MESSAGE_TO_PARTICIPANT_FROM_INPUT,
      async (options: SendMessageToParticipantFromInputOptions) => {
        await this._participantController.sendMessageToParticipantFromInput(
          options,
        );
        return true;
      },
    );
    this.registerParticipantCommand(
      ExtensionCommand.ASK_COPILOT_FROM_TREE_ITEM,
      async (treeItem: DatabaseTreeItem | CollectionTreeItem) => {
        await this._participantController.askCopilotFromTreeItem(treeItem);
        return true;
      },
    );
    this.registerParticipantCommand(
      ExtensionCommand.RUN_PARTICIPANT_CODE,
      ({ runnableContent }: RunParticipantCodeCommandArgs) => {
        return this._playgroundController.evaluateParticipantCode(
          runnableContent,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.CONNECT_WITH_PARTICIPANT,
      (data: { id?: string; command?: string }) => {
        return this._participantController.connectWithParticipant(data);
      },
    );
    this.registerCommand(
      ExtensionCommand.SELECT_DATABASE_WITH_PARTICIPANT,
      (data: {
        chatId: string;
        command: ParticipantCommand;
        databaseName?: string;
      }) => {
        return this._participantController.selectDatabaseWithParticipant(data);
      },
    );
    this.registerCommand(
      ExtensionCommand.SELECT_COLLECTION_WITH_PARTICIPANT,
      (data: any) => {
        return this._participantController.selectCollectionWithParticipant(
          data,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.PARTICIPANT_OPEN_RAW_SCHEMA_OUTPUT,
      async ({ schema }: OpenSchemaCommandArgs) => {
        const document = await vscode.workspace.openTextDocument({
          language: 'json',
          content: schema,
        });
        await vscode.window.showTextDocument(document, { preview: true });

        return !!document;
      },
    );
  };

  registerParticipantCommand = (
    command: ExtensionCommand,
    commandHandler: (...args: any[]) => Promise<boolean>,
  ): void => {
    const commandHandlerWithTelemetry = (args: any[]): Promise<boolean> => {
      this._telemetryService.track(new CommandRunTelemetryEvent(command));

      return commandHandler(args);
    };
    const participant = this._participantController.getParticipant();
    if (participant) {
      this._context.subscriptions.push(
        participant,
        vscode.commands.registerCommand(command, commandHandlerWithTelemetry),
      );
    }
  };

  registerCommand = (
    command: ExtensionCommand,
    commandHandler: (...args: any[]) => Promise<boolean>,
  ): void => {
    const commandHandlerWithTelemetry = (args: any[]): Promise<boolean> => {
      this._telemetryService.track(new CommandRunTelemetryEvent(command));

      return commandHandler(args);
    };

    this._context.subscriptions.push(
      vscode.commands.registerCommand(command, commandHandlerWithTelemetry),
    );
  };

  registerEditorCommands(): void {
    this.registerCommand(
      ExtensionCommand.MDB_CODELENS_SHOW_MORE_DOCUMENTS,
      ({ operationId, connectionId, namespace }) => {
        return this._editorsController.onViewMoreCollectionDocuments(
          operationId,
          connectionId,
          namespace,
        );
      },
    );
  }

  registerTreeViewCommands(): void {
    this.registerCommand(ExtensionCommand.MDB_ADD_CONNECTION, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(ExtensionCommand.MDB_ADD_CONNECTION_WITH_URI, () =>
      this._connectionController.connectWithURI(),
    );
    this.registerCommand(
      ExtensionCommand.MDB_CONNECT_TO_CONNECTION_TREE_VIEW,
      async (connectionTreeItem: ConnectionTreeItem) => {
        const { successfullyConnected } =
          await this._connectionController.connectWithConnectionId(
            connectionTreeItem.connectionId,
          );
        return successfullyConnected;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_DISCONNECT_FROM_CONNECTION_TREE_VIEW,
      () => {
        // In order for this command to be activated, the connection must
        // be the active connection, so we can just generally disconnect.
        return this._connectionController.disconnect();
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_REFRESH_CONNECTION,
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
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_EDIT_PRESET_CONNECTIONS,
      async (element: ConnectionTreeItem | undefined) => {
        await this._connectionController.openPresetConnectionsSettings(element);
        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_COPY_CONNECTION_STRING,
      async (element: ConnectionTreeItem): Promise<boolean> => {
        const connectionString =
          this._connectionController.copyConnectionStringByConnectionId(
            element.connectionId,
          );

        await vscode.env.clipboard.writeText(connectionString);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_REMOVE_CONNECTION_TREE_VIEW,
      (element: ConnectionTreeItem) =>
        this._connectionController.onRemoveMongoDBConnection({
          id: element.connectionId,
        }),
    );
    this.registerCommand(
      ExtensionCommand.MDB_EDIT_CONNECTION,
      (element: ConnectionTreeItem) => {
        const connectionOptions =
          this._connectionController.getConnectionConnectionOptions(
            element.connectionId,
          );

        if (!connectionOptions) {
          return Promise.resolve(false);
        }

        void this._webviewController.openEditConnection({
          connection: {
            id: element.connectionId,
            name: this._connectionController.getSavedConnectionName(
              element.connectionId,
            ),
            connectionOptions,
          },
          context: this._context,
        });
        return Promise.resolve(true);
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_RENAME_CONNECTION,
      (element: ConnectionTreeItem) =>
        this._connectionController.renameConnection(element.connectionId),
    );
    this.registerCommand(
      ExtensionCommand.MDB_ADD_DATABASE,
      async (element: ConnectionTreeItem): Promise<boolean> => {
        if (!element) {
          void vscode.window.showErrorMessage(
            'Please wait for the connection to finish loading before adding a database.',
          );

          return false;
        }

        if (
          element.connectionId !==
          this._connectionController.getActiveConnectionId()
        ) {
          void vscode.window.showErrorMessage(
            'Please connect to this connection before adding a database.',
          );

          return false;
        }

        if (this._connectionController.isDisconnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add database: currently disconnecting.',
          );

          return false;
        }

        if (this._connectionController.isConnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add database: currently connecting.',
          );

          return false;
        }

        return this._playgroundController.createPlaygroundForCreateCollection(
          element,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_COPY_DATABASE_NAME,
      async (element: DatabaseTreeItem) => {
        await vscode.env.clipboard.writeText(element.databaseName);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_DROP_DATABASE,
      async (element: DatabaseTreeItem): Promise<boolean> => {
        const successfullyDroppedDatabase =
          await element.onDropDatabaseClicked();

        if (successfullyDroppedDatabase) {
          void vscode.window.showInformationMessage(
            'Database successfully dropped.',
          );

          // When we successfully drop a database, we need
          // to update the explorer view.
          this._explorerController.refresh();
        }

        return successfullyDroppedDatabase;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_REFRESH_DATABASE,
      async (databaseTreeItem: DatabaseTreeItem): Promise<boolean> => {
        databaseTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({
          collections: true,
          fields: true,
        });

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_ADD_COLLECTION,
      async (element: DatabaseTreeItem): Promise<boolean> => {
        if (this._connectionController.isDisconnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add collection: currently disconnecting.',
          );

          return false;
        }

        return this._playgroundController.createPlaygroundForCreateCollection(
          element,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_COPY_COLLECTION_NAME,
      async (element: CollectionTreeItem): Promise<boolean> => {
        await vscode.env.clipboard.writeText(element.collectionName);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_DROP_COLLECTION,
      async (element: CollectionTreeItem): Promise<boolean> => {
        const successfullyDroppedCollection =
          await element.onDropCollectionClicked();

        if (successfullyDroppedCollection) {
          void vscode.window.showInformationMessage(
            'Collection successfully dropped.',
          );

          // When we successfully drop a collection, we need
          // to update the explorer view.
          this._explorerController.refresh();
        }

        return successfullyDroppedCollection;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_VIEW_COLLECTION_DOCUMENTS,
      (
        element: CollectionTreeItem | DocumentListTreeItem,
      ): Promise<boolean> => {
        const namespace = `${element.databaseName}.${element.collectionName}`;

        return this._editorsController.onViewCollectionDocuments(namespace);
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_REFRESH_COLLECTION,
      async (collectionTreeItem: CollectionTreeItem): Promise<boolean> => {
        collectionTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_SEARCH_FOR_DOCUMENTS,
      (element: DocumentListTreeItem): Promise<boolean> =>
        this._playgroundController.createPlaygroundForSearch(
          element.databaseName,
          element.collectionName,
        ),
    );
    this.registerCommand(
      ExtensionCommand.MDB_OPEN_MONGODB_DOCUMENT_FROM_TREE,
      (element: DocumentTreeItem): Promise<boolean> => {
        return this._editorsController.openMongoDBDocument({
          source: DocumentSource.DOCUMENT_SOURCE_TREEVIEW,
          documentId: element.documentId,
          namespace: element.namespace,
          connectionId: this._connectionController.getActiveConnectionId(),
          line: 1,
        });
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_REFRESH_DOCUMENT_LIST,
      async (documentsListTreeItem: DocumentListTreeItem): Promise<boolean> => {
        await documentsListTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_INSERT_DOCUMENT_FROM_TREE_VIEW,
      async (
        documentsListTreeItem: DocumentListTreeItem | CollectionTreeItem,
      ): Promise<boolean> => {
        return this._playgroundController.createPlaygroundForInsertDocument(
          documentsListTreeItem.databaseName,
          documentsListTreeItem.collectionName,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_REFRESH_SCHEMA,
      async (schemaTreeItem: SchemaTreeItem): Promise<boolean> => {
        schemaTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_COPY_SCHEMA_FIELD_NAME,
      async (fieldTreeItem: FieldTreeItem): Promise<boolean> => {
        await vscode.env.clipboard.writeText(fieldTreeItem.getFieldName());
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_REFRESH_INDEXES,
      (indexListTreeItem: IndexListTreeItem): Promise<boolean> => {
        indexListTreeItem.resetCache();
        this._explorerController.refresh();

        return Promise.resolve(true);
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_CREATE_INDEX_TREE_VIEW,
      (indexListTreeItem: IndexListTreeItem): Promise<boolean> => {
        return this._playgroundController.createPlaygroundForNewIndex(
          indexListTreeItem.databaseName,
          indexListTreeItem.collectionName,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_CREATE_PLAYGROUND_FROM_TREE_VIEW,
      () => this._playgroundController.createPlayground(),
    );
    this.registerCommand(
      ExtensionCommand.MDB_CREATE_PLAYGROUND_FROM_TREE_ITEM,
      (treeItem: DatabaseTreeItem | CollectionTreeItem) =>
        this._playgroundController.createPlaygroundFromTreeItem(treeItem),
    );
    this.registerCommand(
      ExtensionCommand.MDB_REFRESH_PLAYGROUNDS_FROM_TREE_VIEW,
      () => this._playgroundsExplorer.refresh(),
    );
    this.registerCommand(
      ExtensionCommand.MDB_OPEN_PLAYGROUND_FROM_TREE_VIEW,
      (playgroundsTreeItem: PlaygroundsTreeItem) =>
        this._playgroundController.openPlayground(playgroundsTreeItem.filePath),
    );
    this.registerCommand(
      ExtensionCommand.MDB_COPY_DOCUMENT_CONTENTS_FROM_TREE_VIEW,
      async (documentTreeItem: DocumentTreeItem): Promise<boolean> => {
        const documentContents =
          await documentTreeItem.getStringifiedEJSONDocumentContents();
        await vscode.env.clipboard.writeText(documentContents);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_CLONE_DOCUMENT_FROM_TREE_VIEW,
      async (documentTreeItem: DocumentTreeItem): Promise<boolean> => {
        const documentContents =
          await documentTreeItem.getJSStringDocumentContents();

        const [databaseName, collectionName] =
          documentTreeItem.namespace.split(/\.(.*)/s);

        return this._playgroundController.createPlaygroundForCloneDocument(
          documentContents,
          databaseName,
          collectionName,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_DELETE_DOCUMENT_FROM_TREE_VIEW,
      async (documentTreeItem: DocumentTreeItem): Promise<boolean> => {
        const successfullyDropped =
          await documentTreeItem.onDeleteDocumentClicked();

        if (successfullyDropped) {
          void vscode.window.showInformationMessage(
            'Document successfully deleted.',
          );

          // When we successfully drop a document, we need
          // to update the explorer view.
          this._explorerController.refresh();
        }

        return successfullyDropped;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_INSERT_OBJECTID_TO_EDITOR,
      async (): Promise<boolean> => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          void vscode.window.showInformationMessage(
            'No active editor to insert to.',
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
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_GENERATE_OBJECTID_TO_CLIPBOARD,
      async (): Promise<boolean> => {
        await vscode.env.clipboard.writeText(generateId().toHexString());
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerAtlasStreamsTreeViewCommands();

    this.registerCommand(
      ExtensionCommand.START_MCP_SERVER,
      async (): Promise<boolean> => {
        await this._mcpController.startServer();
        return true;
      },
    );

    this.registerCommand(
      ExtensionCommand.STOP_MCP_SERVER,
      async (): Promise<boolean> => {
        await this._mcpController.stopServer();
        return true;
      },
    );

    this.registerCommand(
      ExtensionCommand.GET_MCP_SERVER_CONFIG,
      (): Promise<boolean> => {
        return this._mcpController.openServerConfig();
      },
    );
  }

  registerAtlasStreamsTreeViewCommands(): void {
    this.registerCommand(
      ExtensionCommand.MDB_ADD_STREAM_PROCESSOR,
      async (element: ConnectionTreeItem): Promise<boolean> => {
        if (!element) {
          void vscode.window.showErrorMessage(
            'Please wait for the connection to finish loading before adding a stream processor.',
          );

          return false;
        }

        if (
          element.connectionId !==
          this._connectionController.getActiveConnectionId()
        ) {
          void vscode.window.showErrorMessage(
            'Please connect to this connection before adding a stream processor.',
          );

          return false;
        }

        if (this._connectionController.isDisconnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add stream processor: currently disconnecting.',
          );

          return false;
        }

        if (this._connectionController.isConnecting()) {
          void vscode.window.showErrorMessage(
            'Unable to add stream processor: currently connecting.',
          );

          return false;
        }

        return this._playgroundController.createPlaygroundForCreateStreamProcessor(
          element,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_START_STREAM_PROCESSOR,
      async (element: StreamProcessorTreeItem): Promise<boolean> => {
        const started = await element.onStartClicked();
        if (started) {
          void vscode.window.showInformationMessage(
            'Stream processor successfully started.',
          );
          // Refresh explorer view after a processor is started.
          this._explorerController.refresh();
        }
        return started;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_STOP_STREAM_PROCESSOR,
      async (element: StreamProcessorTreeItem): Promise<boolean> => {
        const stopped = await element.onStopClicked();
        if (stopped) {
          void vscode.window.showInformationMessage(
            'Stream processor successfully stopped.',
          );
          // Refresh explorer view after a processor is stopped.
          this._explorerController.refresh();
        }
        return stopped;
      },
    );
    this.registerCommand(
      ExtensionCommand.MDB_DROP_STREAM_PROCESSOR,
      async (element: StreamProcessorTreeItem): Promise<boolean> => {
        const dropped = await element.onDropClicked();
        if (dropped) {
          void vscode.window.showInformationMessage(
            'Stream processor successfully dropped.',
          );
          // Refresh explorer view after a processor is dropped.
          this._explorerController.refresh();
        }
        return dropped;
      },
    );
  }

  showOverviewPageIfRecentlyInstalled(): void {
    const showOverviewFromSettings = vscode.workspace
      .getConfiguration('mdb')
      .get<boolean>('showOverviewPageAfterInstall');

    if (!showOverviewFromSettings) {
      // Users may opt out of showing the overview page in the settings.
      return;
    }

    const hasBeenShownViewAlready = !!this._storageController.get(
      StorageVariable.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW,
    );

    if (hasBeenShownViewAlready) {
      // Don't show the overview page if it has already been shown.
      return;
    }

    if (!this._connectionStorage.hasSavedConnections()) {
      // Only show the overview page if there are no saved connections.
      void vscode.commands.executeCommand(
        ExtensionCommand.MDB_OPEN_OVERVIEW_PAGE,
      );
    }

    void this._storageController.update(
      StorageVariable.GLOBAL_HAS_BEEN_SHOWN_INITIAL_VIEW,
      true,
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
