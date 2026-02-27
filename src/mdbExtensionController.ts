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
import type { PlaygroundRunCursorResult } from './types/playgroundType';
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
import formatError from './utils/formatError';
import type { DocumentViewAndEditFormat } from './editors/types';
import { getDocumentViewAndEditFormat } from './editors/types';
import type ShowPreviewTreeItem from './explorer/documentPreviewItem';
import DataBrowsingController from './views/dataBrowsingController';

// Deep link command filtering: Commands are explicitly categorized as allowed or disallowed.
// We use tests in mdbExtensionController.test.ts to enforce these lists being disjoint and complete.
export const DEEP_LINK_ALLOWED_COMMANDS = [
  ExtensionCommand.mdbConnect,
  ExtensionCommand.mdbConnectWithUri,
  ExtensionCommand.mdbOpenOverviewPage,
  ExtensionCommand.mdbDisconnect,
  ExtensionCommand.openMongodbIssueReporter,
  ExtensionCommand.mdbOpenMdbShell,
  ExtensionCommand.mdbCreatePlayground,
  ExtensionCommand.mdbRunSelectedPlaygroundBlocks,
  ExtensionCommand.mdbRunAllPlaygroundBlocks,
  ExtensionCommand.mdbRunAllOrSelectedPlaygroundBlocks,
  ExtensionCommand.mdbExportCodeToPlayground,
  ExtensionCommand.mdbFixThisInvalidInteractiveSyntax,
  ExtensionCommand.mdbFixAllInvalidInteractiveSyntax,
  ExtensionCommand.mdbSelectTargetForExportToLanguage,
  ExtensionCommand.mdbExportToLanguage,
  ExtensionCommand.mdbChangeDriverSyntaxForExportToLanguage,
  ExtensionCommand.mdbSaveMongodbDocument,
  ExtensionCommand.mdbChangeActiveConnection,
  ExtensionCommand.mdbCodelensShowMoreDocuments,
  ExtensionCommand.mdbAddConnection,
  ExtensionCommand.mdbAddConnectionWithUri,
  ExtensionCommand.mdbEditConnection,
  ExtensionCommand.mdbRefreshConnection,
  ExtensionCommand.mdbCopyConnectionString,
  ExtensionCommand.mdbEditPresetConnections,
  ExtensionCommand.mdbRenameConnection,
  ExtensionCommand.mdbAddDatabase,
  ExtensionCommand.mdbSearchForDocuments,
  ExtensionCommand.mdbCopyDatabaseName,
  ExtensionCommand.mdbRefreshDatabase,
  ExtensionCommand.mdbAddCollection,
  ExtensionCommand.mdbCopyCollectionName,
  ExtensionCommand.mdbViewCollectionDocuments,
  ExtensionCommand.mdbRefreshCollection,
  ExtensionCommand.mdbRefreshDocumentList,

  ExtensionCommand.mdbRefreshSchema,
  ExtensionCommand.mdbCopySchemaFieldName,
  ExtensionCommand.mdbRefreshIndexes,
  ExtensionCommand.mdbInsertObjectidToEditor,
  ExtensionCommand.mdbGenerateObjectidToClipboard,

  ExtensionCommand.mdbAddStreamProcessor,
  ExtensionCommand.mdbStartStreamProcessor,
  ExtensionCommand.mdbStopStreamProcessor,

  ExtensionCommand.startMcpServer,
  ExtensionCommand.stopMcpServer,
  ExtensionCommand.getMcpServerConfig,
] as const;

export const DEEP_LINK_DISALLOWED_COMMANDS = [
  // Participant commands - internal APIs designed for chat UI only
  ExtensionCommand.runParticipantCode,
  ExtensionCommand.openParticipantCodeInPlayground,
  ExtensionCommand.connectWithParticipant,
  ExtensionCommand.selectDatabaseWithParticipant,
  ExtensionCommand.selectCollectionWithParticipant,
  ExtensionCommand.participantOpenRawSchemaOutput,
  ExtensionCommand.sendMessageToParticipant,
  ExtensionCommand.sendMessageToParticipantFromInput,
  ExtensionCommand.showExportToLanguageResult,
  // Destructive operations
  ExtensionCommand.mdbDropDatabase,
  ExtensionCommand.mdbDropCollection,
  ExtensionCommand.mdbDropStreamProcessor,
  ExtensionCommand.mdbRemoveConnection,

  // Location-specific items - not intended to be accessed in other ways
  ExtensionCommand.mdbDeleteDocumentFromTreeView,
  ExtensionCommand.mdbRemoveConnectionTreeView,
  ExtensionCommand.mdbOpenMdbShellFromTreeView,
  ExtensionCommand.mdbRefreshPlaygroundsFromTreeView,
  ExtensionCommand.mdbOpenPlaygroundFromTreeView,
  ExtensionCommand.mdbConnectToConnectionTreeView,
  ExtensionCommand.mdbCreatePlaygroundFromTreeView,
  ExtensionCommand.mdbCreatePlaygroundFromTreeItem,
  ExtensionCommand.mdbDisconnectFromConnectionTreeView,
  ExtensionCommand.mdbOpenMongodbDocumentFromTree,
  ExtensionCommand.mdbInsertDocumentFromTreeView,
  ExtensionCommand.mdbCopyDocumentContentsFromTreeView,
  ExtensionCommand.mdbCloneDocumentFromTreeView,
  ExtensionCommand.askCopilotFromTreeItem,
  ExtensionCommand.mdbCreateIndexTreeView,
  ExtensionCommand.mdbOpenMongodbDocumentFromCodeLens,
  ExtensionCommand.mdbCreatePlaygroundFromOverviewPage,
  ExtensionCommand.mdbOpenCollectionPreviewFromTreeView,
  ExtensionCommand.mdbOpenMongodbDocumentFromDataBrowser,
  ExtensionCommand.mdbInsertDocumentFromDataBrowser,
  ExtensionCommand.mdbCloneDocumentFromDataBrowser,
  ExtensionCommand.mdbRefreshCollectionFromDataBrowser,
  ExtensionCommand.mdbOpenDataBrowserFromPlayground,
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
  _dataBrowsingController: DataBrowsingController;

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
    this._dataBrowsingController = new DataBrowsingController({
      connectionController: this._connectionController,
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
        `Failed to handle '${vscode.Uri.prototype.toString.call(uri)}': ${formatError(error).message}`,
      );
    }
  };

  registerCommands = (): void => {
    // Register our extension's commands. These are the event handlers and
    // control the functionality of our extension.
    // ------ CONNECTION ------ //
    this.registerCommand(ExtensionCommand.mdbOpenOverviewPage, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(ExtensionCommand.mdbConnect, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(ExtensionCommand.mdbConnectWithUri, (params) => {
      return this._connectionController.connectWithURI(params);
    });
    this.registerCommand(ExtensionCommand.mdbDisconnect, () =>
      this._connectionController.disconnect(),
    );
    this.registerCommand(ExtensionCommand.mdbRemoveConnection, (params) =>
      this._connectionController.onRemoveMongoDBConnection(params),
    );
    this.registerCommand(ExtensionCommand.mdbChangeActiveConnection, () =>
      this._connectionController.changeActiveConnection(),
    );

    this.registerCommand(
      ExtensionCommand.openMongodbIssueReporter,
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
    this.registerCommand(ExtensionCommand.mdbOpenMdbShell, () =>
      launchMongoShell(this._connectionController),
    );
    this.registerCommand(ExtensionCommand.mdbOpenMdbShellFromTreeView, () =>
      launchMongoShell(this._connectionController),
    );

    // ------ PLAYGROUND ------ //
    this.registerCommand(ExtensionCommand.mdbCreatePlayground, () =>
      this._playgroundController.createPlayground(),
    );
    this.registerCommand(
      ExtensionCommand.mdbCreatePlaygroundFromOverviewPage,
      () => this._playgroundController.createPlayground(),
    );
    this.registerCommand(ExtensionCommand.mdbRunSelectedPlaygroundBlocks, () =>
      this._playgroundController.runSelectedPlaygroundBlocks(),
    );
    this.registerCommand(ExtensionCommand.mdbRunAllPlaygroundBlocks, () =>
      this._playgroundController.runAllPlaygroundBlocks(),
    );
    this.registerCommand(
      ExtensionCommand.mdbRunAllOrSelectedPlaygroundBlocks,
      () => this._playgroundController.runAllOrSelectedPlaygroundBlocks(),
    );
    this.registerCommand(ExtensionCommand.mdbExportCodeToPlayground, () =>
      this._participantController.exportCodeToPlayground(),
    );

    this.registerCommand(
      ExtensionCommand.mdbFixThisInvalidInteractiveSyntax,
      (data) =>
        this._playgroundController.fixThisInvalidInteractiveSyntax(data),
    );

    this.registerCommand(
      ExtensionCommand.mdbFixAllInvalidInteractiveSyntax,
      (data) => this._playgroundController.fixAllInvalidInteractiveSyntax(data),
    );

    // ------ EXPORT TO LANGUAGE ------ //
    this.registerCommand(
      ExtensionCommand.mdbSelectTargetForExportToLanguage,
      () => this._participantController.selectTargetForExportToLanguage(),
    );
    this.registerCommand(
      ExtensionCommand.mdbExportToLanguage,
      (language: string) =>
        this._participantController.exportPlaygroundToLanguage(language),
    );
    this.registerCommand(
      ExtensionCommand.mdbChangeDriverSyntaxForExportToLanguage,
      (includeDriverSyntax: boolean) =>
        this._participantController.changeDriverSyntaxForExportToLanguage(
          includeDriverSyntax,
        ),
    );
    this.registerParticipantCommand(
      ExtensionCommand.showExportToLanguageResult,
      (data: ExportToLanguageResult) => {
        return this._playgroundController.showExportToLanguageResult(data);
      },
    );

    // ------ DOCUMENTS ------ //
    this.registerCommand(
      ExtensionCommand.mdbOpenMongodbDocumentFromCodeLens,
      (data: EditDocumentInfo) => {
        this._telemetryService.track(
          new DocumentEditedTelemetryEvent(data.source),
        );

        return this._editorsController.openMongoDBDocument(data);
      },
    );
    this.registerCommand(ExtensionCommand.mdbSaveMongodbDocument, () =>
      this._editorsController.saveMongoDBDocument(),
    );

    this.registerEditorCommands();
    this.registerTreeViewCommands();

    // ------ CHAT PARTICIPANT ------ //
    this.registerParticipantCommand(
      ExtensionCommand.openParticipantCodeInPlayground,
      ({ runnableContent }: RunParticipantCodeCommandArgs) => {
        return this._playgroundController.createPlaygroundFromParticipantCode({
          text: runnableContent,
        });
      },
    );
    this.registerParticipantCommand(
      ExtensionCommand.sendMessageToParticipant,
      async (options: SendMessageToParticipantOptions) => {
        await this._participantController.sendMessageToParticipant(options);
        return true;
      },
    );
    this.registerParticipantCommand(
      ExtensionCommand.sendMessageToParticipantFromInput,
      async (options: SendMessageToParticipantFromInputOptions) => {
        await this._participantController.sendMessageToParticipantFromInput(
          options,
        );
        return true;
      },
    );
    this.registerParticipantCommand(
      ExtensionCommand.askCopilotFromTreeItem,
      async (treeItem: DatabaseTreeItem | CollectionTreeItem) => {
        await this._participantController.askCopilotFromTreeItem(treeItem);
        return true;
      },
    );
    this.registerParticipantCommand(
      ExtensionCommand.runParticipantCode,
      ({ runnableContent }: RunParticipantCodeCommandArgs) => {
        return this._playgroundController.evaluateParticipantCode(
          runnableContent,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.connectWithParticipant,
      (data: { id?: string; command?: string }) => {
        return this._participantController.connectWithParticipant(data);
      },
    );
    this.registerCommand(
      ExtensionCommand.selectDatabaseWithParticipant,
      (data: {
        chatId: string;
        command: ParticipantCommand;
        databaseName?: string;
      }) => {
        return this._participantController.selectDatabaseWithParticipant(data);
      },
    );
    this.registerCommand(
      ExtensionCommand.selectCollectionWithParticipant,
      (data: any) => {
        return this._participantController.selectCollectionWithParticipant(
          data,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.participantOpenRawSchemaOutput,
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
      ExtensionCommand.mdbCodelensShowMoreDocuments,
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
    this.registerCommand(ExtensionCommand.mdbAddConnection, () => {
      this._webviewController.openWebview(this._context);
      return Promise.resolve(true);
    });
    this.registerCommand(ExtensionCommand.mdbAddConnectionWithUri, () =>
      this._connectionController.connectWithURI(),
    );
    this.registerCommand(
      ExtensionCommand.mdbConnectToConnectionTreeView,
      async (connectionTreeItem: ConnectionTreeItem) => {
        const { successfullyConnected } =
          await this._connectionController.connectWithConnectionId(
            connectionTreeItem.connectionId,
          );
        return successfullyConnected;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbDisconnectFromConnectionTreeView,
      () => {
        // In order for this command to be activated, the connection must
        // be the active connection, so we can just generally disconnect.
        return this._connectionController.disconnect();
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbRefreshConnection,
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
      ExtensionCommand.mdbRefreshCollectionFromDataBrowser,
      async ({
        databaseName,
        collectionName,
      }: {
        databaseName: string;
        collectionName: string;
      }): Promise<boolean> => {
        this._explorerController.refreshCollection(
          databaseName,
          collectionName,
        );

        return Promise.resolve(true);
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbEditPresetConnections,
      async (element: ConnectionTreeItem | undefined) => {
        await this._connectionController.openPresetConnectionsSettings(element);
        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbCopyConnectionString,
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
      ExtensionCommand.mdbRemoveConnectionTreeView,
      (element: ConnectionTreeItem) =>
        this._connectionController.onRemoveMongoDBConnection({
          id: element.connectionId,
        }),
    );
    this.registerCommand(
      ExtensionCommand.mdbEditConnection,
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
      ExtensionCommand.mdbRenameConnection,
      (element: ConnectionTreeItem) =>
        this._connectionController.renameConnection(element.connectionId),
    );
    this.registerCommand(
      ExtensionCommand.mdbAddDatabase,
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
      ExtensionCommand.mdbCopyDatabaseName,
      async (element: DatabaseTreeItem) => {
        await vscode.env.clipboard.writeText(element.databaseName);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbDropDatabase,
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
      ExtensionCommand.mdbRefreshDatabase,
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
      ExtensionCommand.mdbAddCollection,
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
      ExtensionCommand.mdbCopyCollectionName,
      async (element: CollectionTreeItem): Promise<boolean> => {
        await vscode.env.clipboard.writeText(element.collectionName);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbDropCollection,
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
      ExtensionCommand.mdbViewCollectionDocuments,
      (
        element: CollectionTreeItem | DocumentListTreeItem,
      ): Promise<boolean> => {
        const namespace = `${element.databaseName}.${element.collectionName}`;

        return this._editorsController.onViewCollectionDocuments(namespace);
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbOpenCollectionPreviewFromTreeView,
      (element: ShowPreviewTreeItem): Promise<boolean> => {
        this._dataBrowsingController.openDataBrowser(this._context, {
          databaseName: element.databaseName,
          collectionName: element.collectionName,
          collectionType: element.type,
        });

        return Promise.resolve(true);
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbOpenDataBrowserFromPlayground,
      ({ result }: { result: PlaygroundRunCursorResult }): Promise<boolean> => {
        const { method } = result.constructionOptions.options;
        if (method === 'find' || method === 'aggregate') {
          // For these the first two args happen to be databvaseName and collectionName
          const [databaseName, collectionName] =
            result.constructionOptions.options.args;

          this._dataBrowsingController.openDataBrowser(this._context, {
            databaseName,
            collectionName,
            collectionType: 'unknown', // TODO: figure this out or remove it
            query: result.constructionOptions,
          });
        } else {
          // we check this before calling this command, but we add this check here just in case
          throw new Error(
            `Only find and aggregate supported becase we need a database and collection. Received method ${method}.`,
          );
        }

        return Promise.resolve(true);
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbOpenMongodbDocumentFromDataBrowser,
      async ({
        documentId,
        namespace,
        format,
        connectionId,
      }: {
        documentId: any;
        namespace: string;
        format: DocumentViewAndEditFormat;
        connectionId: string | null;
      }): Promise<boolean> => {
        await this._editorsController.openMongoDBDocument({
          source: DocumentSource.databrowser,
          documentId,
          namespace,
          format,
          connectionId,
          line: 1,
        });
        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbRefreshCollection,
      async (collectionTreeItem: CollectionTreeItem): Promise<boolean> => {
        collectionTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbSearchForDocuments,
      (element: DocumentListTreeItem): Promise<boolean> =>
        this._playgroundController.createPlaygroundForSearch(
          element.databaseName,
          element.collectionName,
        ),
    );
    this.registerCommand(
      ExtensionCommand.mdbOpenMongodbDocumentFromTree,
      (element: DocumentTreeItem): Promise<boolean> => {
        return this._editorsController.openMongoDBDocument({
          source: DocumentSource.treeview,
          documentId: element.documentId,
          namespace: element.namespace,
          format: getDocumentViewAndEditFormat(),
          connectionId: this._connectionController.getActiveConnectionId(),
          line: 1,
        });
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbRefreshDocumentList,
      async (documentsListTreeItem: DocumentListTreeItem): Promise<boolean> => {
        await documentsListTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbInsertDocumentFromTreeView,
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
      ExtensionCommand.mdbInsertDocumentFromDataBrowser,
      async ({
        databaseName,
        collectionName,
      }: {
        databaseName: string;
        collectionName: string;
      }): Promise<boolean> => {
        return this._playgroundController.createPlaygroundForInsertDocument(
          databaseName,
          collectionName,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbRefreshSchema,
      async (schemaTreeItem: SchemaTreeItem): Promise<boolean> => {
        schemaTreeItem.resetCache();
        this._explorerController.refresh();
        await this._languageServerController.resetCache({ fields: true });

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbCopySchemaFieldName,
      async (fieldTreeItem: FieldTreeItem): Promise<boolean> => {
        await vscode.env.clipboard.writeText(fieldTreeItem.getFieldName());
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbRefreshIndexes,
      (indexListTreeItem: IndexListTreeItem): Promise<boolean> => {
        indexListTreeItem.resetCache();
        this._explorerController.refresh();

        return Promise.resolve(true);
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbCreateIndexTreeView,
      (indexListTreeItem: IndexListTreeItem): Promise<boolean> => {
        return this._playgroundController.createPlaygroundForNewIndex(
          indexListTreeItem.databaseName,
          indexListTreeItem.collectionName,
        );
      },
    );
    this.registerCommand(ExtensionCommand.mdbCreatePlaygroundFromTreeView, () =>
      this._playgroundController.createPlayground(),
    );
    this.registerCommand(
      ExtensionCommand.mdbCreatePlaygroundFromTreeItem,
      (treeItem: DatabaseTreeItem | CollectionTreeItem) =>
        this._playgroundController.createPlaygroundFromTreeItem(treeItem),
    );
    this.registerCommand(
      ExtensionCommand.mdbRefreshPlaygroundsFromTreeView,
      () => this._playgroundsExplorer.refresh(),
    );
    this.registerCommand(
      ExtensionCommand.mdbOpenPlaygroundFromTreeView,
      (playgroundsTreeItem: PlaygroundsTreeItem) =>
        this._playgroundController.openPlayground(playgroundsTreeItem.filePath),
    );
    this.registerCommand(
      ExtensionCommand.mdbCopyDocumentContentsFromTreeView,
      async (documentTreeItem: DocumentTreeItem): Promise<boolean> => {
        const documentFormat = getDocumentViewAndEditFormat();
        const documentContents =
          documentFormat === 'ejson'
            ? await documentTreeItem.getStringifiedEJSONDocumentContents()
            : await documentTreeItem.getJSStringDocumentContents();
        await vscode.env.clipboard.writeText(documentContents);
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbCloneDocumentFromTreeView,
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
      ExtensionCommand.mdbCloneDocumentFromDataBrowser,
      async ({
        documentContents,
        databaseName,
        collectionName,
      }: {
        documentContents: string;
        databaseName: string;
        collectionName: string;
      }): Promise<boolean> => {
        return this._playgroundController.createPlaygroundForCloneDocument(
          documentContents,
          databaseName,
          collectionName,
        );
      },
    );
    this.registerCommand(
      ExtensionCommand.mdbDeleteDocumentFromTreeView,
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
      ExtensionCommand.mdbInsertObjectidToEditor,
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
      ExtensionCommand.mdbGenerateObjectidToClipboard,
      async (): Promise<boolean> => {
        await vscode.env.clipboard.writeText(generateId().toHexString());
        void vscode.window.showInformationMessage('Copied to clipboard.');

        return true;
      },
    );
    this.registerAtlasStreamsTreeViewCommands();

    this.registerCommand(
      ExtensionCommand.startMcpServer,
      async (): Promise<boolean> => {
        await this._mcpController.startServer();
        return true;
      },
    );

    this.registerCommand(
      ExtensionCommand.stopMcpServer,
      async (): Promise<boolean> => {
        await this._mcpController.stopServer();
        return true;
      },
    );

    this.registerCommand(
      ExtensionCommand.getMcpServerConfig,
      (): Promise<boolean> => {
        return this._mcpController.openServerConfig();
      },
    );
  }

  registerAtlasStreamsTreeViewCommands(): void {
    this.registerCommand(
      ExtensionCommand.mdbAddStreamProcessor,
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
      ExtensionCommand.mdbStartStreamProcessor,
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
      ExtensionCommand.mdbStopStreamProcessor,
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
      ExtensionCommand.mdbDropStreamProcessor,
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
      StorageVariable.globalHasBeenShownInitialView,
    );

    if (hasBeenShownViewAlready) {
      // Don't show the overview page if it has already been shown.
      return;
    }

    if (!this._connectionStorage.hasSavedConnections()) {
      // Only show the overview page if there are no saved connections.
      void vscode.commands.executeCommand(ExtensionCommand.mdbOpenOverviewPage);
    }

    void this._storageController.update(
      StorageVariable.globalHasBeenShownInitialView,
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
    this._dataBrowsingController.deactivate();
    this._activeConnectionCodeLensProvider.deactivate();
    this._connectionController.deactivate();
  }
}
