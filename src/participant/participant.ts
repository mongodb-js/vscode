import * as vscode from 'vscode';
import { getSimplifiedSchema, parseSchema } from 'mongodb-schema';
import type { Document } from 'bson';
import type { Reference } from 'mongodb-rag-core';
import util from 'util';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import type { LoadedConnection } from '../storage/connectionStorage';
import EXTENSION_COMMANDS from '../commands';
import type { StorageController } from '../storage';
import { StorageVariables } from '../storage';
import { getContentLength, Prompts } from './prompts';
import type { ChatResult } from './constants';
import {
  askToConnectChatResult,
  CHAT_PARTICIPANT_ID,
  emptyRequestChatResult,
  genericRequestChatResult,
  namespaceRequestChatResult,
  queryRequestChatResult,
  doctorRequestChatResult,
  docsRequestChatResult,
  schemaRequestChatResult,
  createCancelledRequestChatResult,
  codeBlockIdentifier,
} from './constants';
import { SchemaFormatter } from './schema';
import { getSimplifiedSampleDocuments } from './sampleDocuments';
import { getCopilotModel } from './model';
import { createMarkdownLink } from './markdown';
import { ChatMetadataStore } from './chatMetadata';
import {
  DOCUMENTS_TO_SAMPLE_FOR_SCHEMA_PROMPT,
  type OpenSchemaCommandArgs,
} from './prompts/schema';
import {
  ExportToPlaygroundFailedTelemetryEvent,
  ParticipantChatOpenedFromActionTelemetryEvent,
  ParticipantFeedbackTelemetryEvent,
  ParticipantInputBoxSubmittedTelemetryEvent,
  ParticipantPromptSubmittedFromActionTelemetryEvent,
  ParticipantPromptSubmittedTelemetryEvent,
  ParticipantResponseFailedTelemetryEvent,
  ParticipantResponseGeneratedTelemetryEvent,
  ParticipantWelcomeShownTelemetryEvent,
  PlaygroundExportedToLanguageTelemetryEvent,
} from '../telemetry';
import { DocsChatbotAIService } from './docsChatbotAIService';
import type { TelemetryService } from '../telemetry';
import formatError from '../utils/formatError';
import { getContent, type ModelInput } from './prompts/promptBase';
import { processStreamWithIdentifiers } from './streamParsing';
import type { PromptIntent } from './prompts/intent';
import { isPlayground, getSelectedText, getAllText } from '../utils/playground';
import type { DataService } from 'mongodb-data-service';
import {
  ParticipantErrorTypes,
  type ExportToPlaygroundError,
} from './participantErrorTypes';
import type PlaygroundResultProvider from '../editors/playgroundResultProvider';
import { isExportToLanguageResult } from '../types/playgroundType';
import { PromptHistory } from './prompts/promptHistory';
import type {
  SendMessageToParticipantOptions,
  SendMessageToParticipantFromInputOptions,
  ParticipantCommand,
  ParticipantCommandType,
} from './participantTypes';
import { DEFAULT_EXPORT_TO_LANGUAGE_DRIVER_SYNTAX } from '../editors/exportToLanguageCodeLensProvider';
import { EXPORT_TO_LANGUAGE_ALIASES } from '../editors/playgroundSelectionCodeActionProvider';
import { CollectionTreeItem, DatabaseTreeItem } from '../explorer';
import { DocumentSource } from '../documentSource';
import AtlasApiController from '../atlasApiController';

const log = createLogger('participant');

const NUM_DOCUMENTS_TO_SAMPLE = 3;

const MONGODB_DOCS_LINK = 'https://www.mongodb.com/docs/';

interface ParticipantQuickPicks {
  label: string;
  data: string;
}

export type RunParticipantCodeCommandArgs = {
  runnableContent: string;
};

const MAX_MARKDOWN_LIST_LENGTH = 10;

export default class ParticipantController {
  _participant?: vscode.ChatParticipant;
  _connectionController: ConnectionController;
  _storageController: StorageController;
  _chatMetadataStore: ChatMetadataStore;
  _docsChatbotAIService: DocsChatbotAIService;
  _telemetryService: TelemetryService;
  _playgroundResultProvider: PlaygroundResultProvider;
  _atlasApiController: AtlasApiController;

  constructor({
    connectionController,
    storageController,
    telemetryService,
    playgroundResultProvider,
  }: {
    connectionController: ConnectionController;
    storageController: StorageController;
    telemetryService: TelemetryService;
    playgroundResultProvider: PlaygroundResultProvider;
  }) {
    this._connectionController = connectionController;
    this._storageController = storageController;
    this._chatMetadataStore = new ChatMetadataStore();
    this._telemetryService = telemetryService;
    this._docsChatbotAIService = new DocsChatbotAIService();
    this._playgroundResultProvider = playgroundResultProvider;
    this._atlasApiController = new AtlasApiController({ storageController });
  }

  createParticipant(context: vscode.ExtensionContext): vscode.ChatParticipant {
    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    this._participant = vscode.chat.createChatParticipant(
      CHAT_PARTICIPANT_ID,
      this.chatHandler.bind(this),
    );
    this._participant.iconPath = vscode.Uri.joinPath(
      vscode.Uri.parse(context.extensionPath),
      'images',
      'mongodb.png',
    );
    log.info('Chat participant created', {
      participantId: this._participant?.id,
    });
    this._participant.onDidReceiveFeedback(this.handleUserFeedback.bind(this));

    return this._participant;
  }

  getParticipant(): vscode.ChatParticipant | undefined {
    return this._participant;
  }

  /**
   * In order to get access to the model, and to write more messages to the chat after
   * an async event that occurs after we've already completed our response, we need
   * to be handling a chat request. This could be when a user clicks a button or link
   * in the chat. To work around this, we can write a message as the user, which will
   * trigger the chat handler and give us access to the model.
   */
  async sendMessageToParticipant(
    options: SendMessageToParticipantOptions,
  ): Promise<unknown> {
    const {
      message,
      isNewChat = false,
      isPartialQuery = false,
      telemetry,
      command,
      ...otherOptions
    } = options;

    if (isNewChat) {
      await vscode.commands.executeCommand('workbench.action.chat.newChat');
      await vscode.commands.executeCommand(
        'workbench.action.chat.clearHistory',
      );
    }
    const commandPrefix = command ? `/${command} ` : '';
    const query = `@MongoDB ${commandPrefix}${message}`;

    if (telemetry) {
      if (isNewChat) {
        this._telemetryService.track(
          new ParticipantChatOpenedFromActionTelemetryEvent(telemetry, command),
        );
      }
      if (!isPartialQuery) {
        this._telemetryService.track(
          new ParticipantPromptSubmittedFromActionTelemetryEvent(
            telemetry,
            command ?? 'generic',
            query.length,
          ),
        );
      }
    }

    return await vscode.commands.executeCommand('workbench.action.chat.open', {
      ...otherOptions,
      query,
      isPartialQuery,
    });
  }

  async sendMessageToParticipantFromInput(
    options: SendMessageToParticipantFromInputOptions,
  ): Promise<unknown> {
    const {
      isNewChat,
      isPartialQuery,
      telemetry,
      command,
      ...inputBoxOptions
    } = options;

    const message = await vscode.window.showInputBox({
      ...inputBoxOptions,
    });

    if (telemetry) {
      this._telemetryService.track(
        new ParticipantInputBoxSubmittedTelemetryEvent(
          telemetry,
          message,
          command,
        ),
      );
    }

    if (message === undefined || message.trim() === '') {
      return Promise.resolve();
    }

    return this.sendMessageToParticipant({
      message,
      telemetry,
      command,
      isNewChat,
      isPartialQuery,
    });
  }

  async askCopilotFromTreeItem(
    treeItem: DatabaseTreeItem | CollectionTreeItem,
  ): Promise<void> {
    if (treeItem instanceof DatabaseTreeItem) {
      const { databaseName } = treeItem;

      await this.sendMessageToParticipant({
        message: `I want to ask questions about the \`${databaseName}\` database.`,
        isNewChat: true,
        telemetry: {
          source: DocumentSource.DOCUMENT_SOURCE_TREEVIEW,
          source_details: 'database',
        },
      });
    } else if (treeItem instanceof CollectionTreeItem) {
      const { databaseName, collectionName } = treeItem;

      await this.sendMessageToParticipant({
        message: `I want to ask questions about the \`${databaseName}\` database's \`${collectionName}\` collection.`,
        isNewChat: true,
        telemetry: {
          source: DocumentSource.DOCUMENT_SOURCE_TREEVIEW,
          source_details: 'collection',
        },
      });
    } else {
      throw new Error('Unsupported tree item type');
    }
  }

  async _getChatResponse({
    modelInput,
    token,
  }: {
    modelInput: ModelInput;
    token: vscode.CancellationToken;
  }): Promise<vscode.LanguageModelChatResponse> {
    const model = await getCopilotModel();

    if (!model) {
      throw new Error('Copilot model not found');
    }

    log.info('Sending request to model', {
      messages: modelInput.messages.map(
        (message: vscode.LanguageModelChatMessage) =>
          util.inspect({
            role: message.role,
            contentLength: getContentLength(message),
          }),
      ),
    });
    this._telemetryService.track(
      new ParticipantPromptSubmittedTelemetryEvent(modelInput.stats),
    );

    const modelResponse = await model.sendRequest(
      modelInput.messages,
      {},
      token,
    );

    log.info('Model response received');

    return modelResponse;
  }

  async streamChatResponse({
    modelInput,
    stream,
    token,
  }: {
    modelInput: ModelInput;
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }): Promise<{ outputLength: number }> {
    const chatResponse = await this._getChatResponse({
      modelInput,
      token,
    });

    let length = 0;
    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
      length += fragment.length;
    }

    return {
      outputLength: length,
    };
  }

  _streamCodeBlockActions({
    runnableContent,
    stream,
  }: {
    runnableContent: string;
    stream: vscode.ChatResponseStream;
  }): void {
    runnableContent = runnableContent.trim();

    if (!runnableContent) {
      return;
    }

    const commandArgs: RunParticipantCodeCommandArgs = {
      runnableContent,
    };
    stream.button({
      command: EXTENSION_COMMANDS.RUN_PARTICIPANT_CODE,
      title: vscode.l10n.t('▶️ Run'),
      arguments: [commandArgs],
    });
    stream.button({
      command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_CODE_IN_PLAYGROUND,
      title: vscode.l10n.t('Open in playground'),
      arguments: [commandArgs],
    });
  }

  async streamChatResponseWithExportToLanguage({
    modelInput,
    token,
    language,
  }: {
    modelInput: ModelInput;
    token: vscode.CancellationToken;
    language?: string;
  }): Promise<string | null> {
    try {
      const chatResponse = await this._getChatResponse({
        modelInput,
        token,
      });

      const languageCodeBlockIdentifier = {
        start: `\`\`\`${language ? language : 'javascript'}`,
        end: '```',
      };

      const runnableContent: string[] = [];
      await processStreamWithIdentifiers({
        processStreamFragment: () => {},
        onStreamIdentifier: (content: string) => {
          runnableContent.push(content.trim());
        },
        inputIterable: chatResponse.text,
        identifier: languageCodeBlockIdentifier,
      });
      return runnableContent.length ? runnableContent.join('') : null;
    } catch (error) {
      /** If anything goes wrong with the response or the stream, return null instead of throwing. */
      log.error(
        'Error while streaming chat response with export to language',
        error,
      );
      return null;
    }
  }

  async streamChatResponseContentWithCodeActions({
    modelInput,
    stream,
    token,
  }: {
    modelInput: ModelInput;
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }): Promise<{
    outputLength: number;
    hasCodeBlock: boolean;
  }> {
    const chatResponse = await this._getChatResponse({
      modelInput,
      token,
    });

    let outputLength = 0;
    let hasCodeBlock = false;
    await processStreamWithIdentifiers({
      processStreamFragment: (fragment: string) => {
        stream.markdown(fragment);
        outputLength += fragment.length;
      },
      onStreamIdentifier: (content: string) => {
        this._streamCodeBlockActions({ runnableContent: content, stream });
        hasCodeBlock = true;
      },
      inputIterable: chatResponse.text,
      identifier: codeBlockIdentifier,
    });

    log.info('Streamed response to chat', {
      outputLength,
      hasCodeBlock,
    });

    return {
      outputLength,
      hasCodeBlock,
    };
  }

  // This will stream all of the response content and create a string from it.
  // It should only be used when the entire response is needed at one time.
  async getChatResponseContent({
    modelInput,
    token,
  }: {
    modelInput: ModelInput;
    token: vscode.CancellationToken;
  }): Promise<string> {
    let responseContent = '';
    const chatResponse = await this._getChatResponse({
      modelInput,
      token,
    });
    for await (const fragment of chatResponse.text) {
      responseContent += fragment;
    }

    return responseContent;
  }

  async _handleRoutedGenericRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<ChatResult> {
    const modelInput = await Prompts.generic.buildMessages({
      request,
      context,
      connectionNames: this._getConnectionNames(),
    });

    const { hasCodeBlock, outputLength } =
      await this.streamChatResponseContentWithCodeActions({
        modelInput,
        token,
        stream,
      });

    this._telemetryService.track(
      new ParticipantResponseGeneratedTelemetryEvent({
        command: 'generic',
        hasCta: false,
        foundNamespace: false,
        hasRunnableContent: hasCodeBlock,
        outputLength: outputLength,
      }),
    );

    return genericRequestChatResult(context.history);
  }

  async _routeRequestToHandler({
    context,
    promptIntent,
    request,
    stream,
    token,
  }: {
    context: vscode.ChatContext;
    promptIntent: Omit<PromptIntent, 'Default'>;
    request: vscode.ChatRequest;
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }): Promise<ChatResult> {
    switch (promptIntent) {
      case 'Query':
        return this.handleQueryRequest(request, context, stream, token);
      case 'Docs':
        return this.handleDocsRequest(request, context, stream, token);
      case 'Schema':
        return this.handleSchemaRequest(request, context, stream, token);
      case 'Code':
        return this.handleQueryRequest(request, context, stream, token);
      case 'Doctor':
        return this.handleDoctorRequest(request, context, stream, token);
      default:
        return this._handleRoutedGenericRequest(
          request,
          context,
          stream,
          token,
        );
    }
  }

  async _getIntentFromChatRequest({
    context,
    request,
    token,
  }: {
    context: vscode.ChatContext;
    request: vscode.ChatRequest;
    token: vscode.CancellationToken;
  }): Promise<PromptIntent> {
    if (request.command === 'doctor') {
      return 'Doctor';
    }

    const modelInput = await Prompts.intent.buildMessages({
      connectionNames: this._getConnectionNames(),
      request,
      context,
    });

    const responseContent = await this.getChatResponseContent({
      modelInput,
      token,
    });

    log.info('Received intent response from model', {
      responseContentLength: responseContent.length,
    });

    if (request.command === 'doctor') {
      return 'Doctor';
    }

    return Prompts.intent.getIntentFromModelResponse(responseContent);
  }

  async handleGenericRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<ChatResult> {
    // We "prompt chain" to handle the generic requests.
    // First we ask the model to parse for intent.
    // If there is an intent, we can route it to one of the handlers (/commands).
    // When there is no intention or it's generic we handle it with a generic handler.
    const promptIntent = await this._getIntentFromChatRequest({
      context,
      request,
      token,
    });

    if (token.isCancellationRequested) {
      return this._handleCancelledRequest({
        context,
        stream,
      });
    }

    return this._routeRequestToHandler({
      context,
      promptIntent,
      request,
      stream,
      token,
    });
  }

  async connectWithParticipant({
    id,
    command,
  }: {
    id?: string;
    command?: string;
  }): Promise<boolean> {
    if (!id) {
      const didChangeActiveConnection =
        await this._connectionController.changeActiveConnection();
      if (!didChangeActiveConnection) {
        // If they don't choose a connection then we can't proceed;
        return false;
      }
    } else {
      await this._connectionController.connectWithConnectionId(id);
    }

    const connectionName = this._connectionController.getActiveConnectionName();

    return this.sendMessageToParticipant({
      message: `${command ? `${command} ` : ''}${connectionName}`,
    }) as Promise<boolean>;
  }

  getConnectionsTree(command: ParticipantCommand): vscode.MarkdownString[] {
    return [
      ...this._connectionController
        .getSavedConnections()
        .sort((a, b) => {
          const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, MAX_MARKDOWN_LIST_LENGTH)
        .map((conn: LoadedConnection) =>
          createMarkdownLink({
            commandId: EXTENSION_COMMANDS.CONNECT_WITH_PARTICIPANT,
            data: {
              id: conn.id,
              command,
            },
            name: conn.name,
          }),
        ),
      createMarkdownLink({
        commandId: EXTENSION_COMMANDS.CONNECT_WITH_PARTICIPANT,
        name: 'Show more',
        data: {
          command,
        },
      }),
    ];
  }

  async getDatabaseQuickPicks(
    command: ParticipantCommand,
  ): Promise<ParticipantQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      // Run a blank command to get the user to connect first.
      void this.sendMessageToParticipant({ message: command });
      return [];
    }

    try {
      const databases = await dataService.listDatabases({
        nameOnly: true,
      });
      return databases.map((db) => ({
        label: db.name,
        data: db.name,
      }));
    } catch (error) {
      return [];
    }
  }

  async _selectDatabaseWithQuickPick(
    command: ParticipantCommand,
  ): Promise<string | undefined> {
    const databases = await this.getDatabaseQuickPicks(command);
    const selectedQuickPickItem = await vscode.window.showQuickPick(databases, {
      placeHolder: 'Select a database...',
    });
    return selectedQuickPickItem?.data;
  }

  async selectDatabaseWithParticipant({
    chatId,
    command,
    databaseName: _databaseName,
  }: {
    chatId: string;
    command: ParticipantCommand;
    databaseName?: string;
  }): Promise<boolean> {
    let databaseName: string | undefined = _databaseName;
    if (!databaseName) {
      databaseName = await this._selectDatabaseWithQuickPick(command);
      if (!databaseName) {
        return false;
      }
    }

    this._chatMetadataStore.setChatMetadata(chatId, {
      databaseName: databaseName,
    });

    return this.sendMessageToParticipant({
      message: `${command} ${databaseName}`,
    }) as Promise<boolean>;
  }

  async getCollectionQuickPicks({
    command,
    databaseName,
  }: {
    command: ParticipantCommand;
    databaseName: string;
  }): Promise<ParticipantQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      // Run a blank command to get the user to connect first.
      void this.sendMessageToParticipant({ message: command });
      return [];
    }

    try {
      const collections = await dataService.listCollections(databaseName);
      return collections.map((db) => ({
        label: db.name,
        data: db.name,
      }));
    } catch (error) {
      return [];
    }
  }

  async _selectCollectionWithQuickPick({
    command,
    databaseName,
  }: {
    command: ParticipantCommand;
    databaseName: string;
  }): Promise<string | undefined> {
    const collections = await this.getCollectionQuickPicks({
      command,
      databaseName,
    });
    const selectedQuickPickItem = await vscode.window.showQuickPick(
      collections,
      {
        placeHolder: 'Select a collection...',
      },
    );
    return selectedQuickPickItem?.data;
  }

  async selectCollectionWithParticipant({
    command,
    chatId,
    databaseName,
    collectionName: _collectionName,
  }: {
    command: ParticipantCommand;
    chatId: string;
    databaseName: string;
    collectionName?: string;
  }): Promise<boolean> {
    let collectionName: string | undefined = _collectionName;
    if (!collectionName) {
      collectionName = await this._selectCollectionWithQuickPick({
        command,
        databaseName,
      });
      if (!collectionName) {
        return false;
      }
    }

    this._chatMetadataStore.setChatMetadata(chatId, {
      databaseName: databaseName,
      collectionName: collectionName,
    });
    return this.sendMessageToParticipant({
      message: `${command} ${collectionName}`,
    }) as Promise<boolean>;
  }

  renderDatabasesTree({
    command,
    context,
    stream,
    databases,
  }: {
    command: ParticipantCommand;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
    databases: {
      _id: string;
      name: string;
    }[];
  }): void {
    databases.slice(0, MAX_MARKDOWN_LIST_LENGTH).forEach((db) =>
      stream.markdown(
        createMarkdownLink({
          commandId: EXTENSION_COMMANDS.SELECT_DATABASE_WITH_PARTICIPANT,
          data: {
            command,
            chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
              context.history,
            ),
            databaseName: db.name,
          },
          name: db.name,
        }),
      ),
    );

    if (databases.length > MAX_MARKDOWN_LIST_LENGTH) {
      stream.markdown(
        createMarkdownLink({
          data: {
            command,
            chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
              context.history,
            ),
          },
          commandId: EXTENSION_COMMANDS.SELECT_DATABASE_WITH_PARTICIPANT,
          name: 'Show more',
        }),
      );
    }
  }

  renderCollectionsTree({
    collections,
    command,
    context,
    databaseName,
    stream,
  }: {
    collections: Awaited<ReturnType<DataService['listCollections']>>;
    command: ParticipantCommand;
    databaseName: string;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
  }): void {
    collections.slice(0, MAX_MARKDOWN_LIST_LENGTH).forEach((coll) =>
      stream.markdown(
        createMarkdownLink({
          commandId: EXTENSION_COMMANDS.SELECT_COLLECTION_WITH_PARTICIPANT,
          data: {
            command,
            chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
              context.history,
            ),
            databaseName,
            collectionName: coll.name,
          },
          name: coll.name,
        }),
      ),
    );
    if (collections.length > MAX_MARKDOWN_LIST_LENGTH) {
      stream.markdown(
        createMarkdownLink({
          commandId: EXTENSION_COMMANDS.SELECT_COLLECTION_WITH_PARTICIPANT,
          data: {
            command,
            chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
              context.history,
            ),
            databaseName,
          },
          name: 'Show more',
        }),
      );
    }
  }

  async _getNamespaceFromChat({
    request,
    context,
    token,
  }: {
    request: vscode.ChatRequest;
    context: vscode.ChatContext;
    token: vscode.CancellationToken;
  }): Promise<{
    databaseName: string | undefined;
    collectionName: string | undefined;
  }> {
    const messagesWithNamespace = await Prompts.namespace.buildMessages({
      context,
      request,
      connectionNames: this._getConnectionNames(),
    });

    let {
      databaseName,
      collectionName,
    }: {
      databaseName: string | undefined;
      collectionName: string | undefined;
    } = {
      databaseName: undefined,
      collectionName: undefined,
    };

    // When there's no user message content we can
    // skip the request to the model. This would happen with /schema.
    if (Prompts.doMessagesContainUserInput(messagesWithNamespace.messages)) {
      // VSCODE-626: When there's an empty message sent to the ai model,
      // it currently errors (not on insiders, only main VSCode).
      // Here we're defaulting to have some content as a workaround.
      // TODO: Remove this when the issue is fixed.
      if (
        !Prompts.doMessagesContainUserInput([
          messagesWithNamespace.messages[
            messagesWithNamespace.messages.length - 1
          ],
        ])
      ) {
        messagesWithNamespace.messages[
          messagesWithNamespace.messages.length - 1
          // eslint-disable-next-line new-cap
        ] = vscode.LanguageModelChatMessage.User('see previous messages');
      }
      const responseContentWithNamespace = await this.getChatResponseContent({
        modelInput: messagesWithNamespace,
        token,
      });
      ({ databaseName, collectionName } =
        Prompts.namespace.extractDatabaseAndCollectionNameFromResponse(
          responseContentWithNamespace,
        ));
    }

    // See if there's a namespace set in the
    // chat metadata we can fallback to if the model didn't find it.
    const chatId = ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
      context.history,
    );
    const {
      databaseName: databaseNameFromMetadata,
      collectionName: collectionNameFromMetadata,
    } = this._chatMetadataStore.getChatMetadata(chatId) ?? {};

    log.info('Namespaces found in chat', {
      databaseName: databaseName || databaseNameFromMetadata,
      collectionName: collectionName || collectionNameFromMetadata,
    });

    return {
      databaseName: databaseName || databaseNameFromMetadata,
      collectionName: collectionName || collectionNameFromMetadata,
    };
  }

  async _getDatabases({
    stream,
  }: {
    stream: vscode.ChatResponseStream;
  }): Promise<
    {
      _id: string;
      name: string;
    }[]
  > {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      throw new Error(vscode.l10n.t('Failed to get the data service'));
    }

    stream.push(
      new vscode.ChatResponseProgressPart('Fetching database names...'),
    );

    try {
      return await dataService.listDatabases({
        nameOnly: true,
      });
    } catch (error) {
      log.error('Unable to fetch databases:', error);

      throw new Error(
        vscode.l10n.t(
          `Unable to fetch database names: ${formatError(error).message}.`,
        ),
      );
    }
  }

  async _getCollections({
    stream,
    databaseName,
  }: {
    stream: vscode.ChatResponseStream;
    databaseName: string;
  }): Promise<ReturnType<DataService['listCollections']>> {
    const dataService = this._connectionController.getActiveDataService();

    if (!dataService) {
      throw new Error(vscode.l10n.t('Failed to get the data service'));
    }

    stream.push(
      new vscode.ChatResponseProgressPart('Fetching collection names...'),
    );

    try {
      return await dataService.listCollections(databaseName);
    } catch (error) {
      log.error('Unable to fetch collection names:', error);

      throw new Error(
        vscode.l10n.t(
          `Unable to fetch collection names from ${databaseName}: ${
            formatError(error).message
          }.`,
        ),
      );
    }
  }

  /** Gets the collection name if there is only one collection.
   *  Otherwise returns undefined and asks the user to select the collection. */
  async _getOrAskForCollectionName({
    context,
    databaseName,
    stream,
    command,
  }: {
    command: ParticipantCommand;
    context: vscode.ChatContext;
    databaseName: string;
    stream: vscode.ChatResponseStream;
  }): Promise<string | undefined> {
    const collections = await this._getCollections({ stream, databaseName });

    if (collections.length === 0) {
      throw new Error(
        vscode.l10n.t(
          `No collections were found in the database ${databaseName}.`,
        ),
      );
    }
    if (collections.length === 1) {
      return collections[0].name;
    }

    stream.markdown(
      vscode.l10n.t(
        `Which collection would you like to use within ${databaseName}? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n`,
      ),
    );

    this.renderCollectionsTree({
      collections,
      command,
      databaseName,
      context,
      stream,
    });

    return undefined;
  }

  /** Gets the database name if there is only one collection.
   *  Otherwise returns undefined and asks the user to select the database. */
  async _getOrAskForDatabaseName({
    command,
    context,
    stream,
  }: {
    command: ParticipantCommand;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
  }): Promise<string | undefined> {
    const databases = await this._getDatabases({ stream });

    if (databases.length === 0) {
      throw new Error(vscode.l10n.t('No databases were found.'));
    }

    if (databases.length === 1) {
      return databases[0].name;
    }

    // If no database or collection name is found in the user prompt,
    // we retrieve the available namespaces from the current connection.
    // Users can then select a value by clicking on an item in the list
    // or typing the name manually.
    stream.markdown(
      vscode.l10n.t(
        `Which database would you like ${
          command === '/query' ? 'this query to run against' : 'to use'
        }? Select one by either clicking on an item in the list or typing the name manually in the chat.\n\n`,
      ),
    );

    this.renderDatabasesTree({
      databases,
      command,
      context,
      stream,
    });

    return undefined;
  }

  /** Helper which either automatically picks and returns missing parts of the namespace (if any)
   *  or prompts the user to pick the missing namespace.
   */
  async _getOrAskForMissingNamespace({
    databaseName,
    collectionName,
    context,
    stream,
    command,
  }: {
    databaseName: string | undefined;
    collectionName: string | undefined;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
    command: ParticipantCommand;
  }): Promise<{
    databaseName: string | undefined;
    collectionName: string | undefined;
  }> {
    if (!databaseName) {
      databaseName = await this._getOrAskForDatabaseName({
        command,
        context,
        stream,
      });

      // databaseName will be undefined if it cannot be found from
      // the metadata or history, in which case the user will be prompted
      // to select it or if some error occurs.
      if (!databaseName) {
        return { databaseName, collectionName };
      }

      this._chatMetadataStore.patchChatMetadata(context, {
        databaseName,
      });
    }

    if (!collectionName) {
      collectionName = await this._getOrAskForCollectionName({
        command,
        context,
        databaseName,
        stream,
      });

      // If the collection name could not get automatically selected,
      // then the user has been prompted for it instead.
      if (!collectionName) {
        return {
          databaseName,
          collectionName,
        };
      }

      this._chatMetadataStore.patchChatMetadata(context, {
        collectionName,
      });
    }

    return { collectionName, databaseName };
  }

  _doesLastMessageAskForNamespace(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>,
  ): boolean {
    const lastMessageMetaData = history[
      history.length - 1
    ] as vscode.ChatResponseTurn;

    return (
      (lastMessageMetaData?.result as ChatResult)?.metadata?.intent ===
      'askForNamespace'
    );
  }

  _askToConnect({
    command,
    context,
    stream,
  }: {
    command: ParticipantCommand;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
  }): ChatResult {
    log.info('Participant asked user to connect');

    stream.markdown(
      "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n",
    );

    const tree = this.getConnectionsTree(command);
    for (const item of tree) {
      stream.markdown(item);
    }
    return askToConnectChatResult(context.history);
  }

  _handleCancelledRequest({
    context,
    stream,
  }: {
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
  }): ChatResult {
    stream.markdown('\nRequest cancelled.');

    return createCancelledRequestChatResult(context.history);
  }

  // The sample documents returned from this are simplified (strings and arrays shortened).
  // The sample documents are only returned when a user has the setting enabled.
  async _fetchCollectionSchemaAndSampleDocuments({
    databaseName,
    collectionName,
    amountOfDocumentsToSample = NUM_DOCUMENTS_TO_SAMPLE,
    schemaFormat = 'simplified',
    token,
    stream,
  }: {
    databaseName: string;
    collectionName: string;
    amountOfDocumentsToSample?: number;
    schemaFormat?: 'simplified' | 'full';
    token: vscode.CancellationToken;
    stream: vscode.ChatResponseStream;
  }): Promise<{
    schema?: string;
    sampleDocuments?: Document[];
    amountOfDocumentsSampled: number;
  }> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return {
        amountOfDocumentsSampled: 0,
      };
    }

    stream.push(
      new vscode.ChatResponseProgressPart(
        'Fetching documents and analyzing schema...',
      ),
    );

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    try {
      const sampleDocuments = await dataService.sample(
        `${databaseName}.${collectionName}`,
        {
          query: {},
          size: amountOfDocumentsToSample,
        },
        { promoteValues: false, maxTimeMS: 10_000 },
        {
          abortSignal: abortController.signal,
        },
      );

      if (!sampleDocuments) {
        return {
          amountOfDocumentsSampled: 0,
        };
      }

      let schema: string;
      if (schemaFormat === 'simplified') {
        const unformattedSchema = await getSimplifiedSchema(sampleDocuments);
        schema = new SchemaFormatter().format(unformattedSchema);
      } else {
        const unformattedSchema = await parseSchema(sampleDocuments, {
          storeValues: false,
        });
        schema = JSON.stringify(unformattedSchema, null, 2);
      }

      const useSampleDocsInCopilot = !!vscode.workspace
        .getConfiguration('mdb')
        .get('useSampleDocsInCopilot');

      return {
        sampleDocuments: useSampleDocsInCopilot
          ? getSimplifiedSampleDocuments(sampleDocuments)
          : undefined,
        schema,
        amountOfDocumentsSampled: sampleDocuments.length,
      };
    } catch (err: any) {
      log.error('Unable to fetch schema and sample documents:', err);
      throw err;
    }
  }

  async handleEmptyNamespaceMessage({
    command,
    context,
    stream,
  }: {
    command: ParticipantCommand;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
  }): Promise<ChatResult> {
    const lastMessageMetaData: vscode.ChatResponseTurn | undefined = context
      .history[context.history.length - 1] as vscode.ChatResponseTurn;
    const lastMessage = lastMessageMetaData?.result as ChatResult;
    if (lastMessage?.metadata?.intent !== 'askForNamespace') {
      stream.markdown(Prompts.generic.getEmptyRequestResponse());
      return emptyRequestChatResult(context.history);
    }

    // When the last message was asking for a database or collection name,
    // we re-ask the question.
    const metadataDatabaseName = lastMessage.metadata.databaseName;

    // This will prompt the user for the missing databaseName or the collectionName.
    // If anything in the namespace can be automatically picked, it will be returned.
    const { databaseName, collectionName } =
      await this._getOrAskForMissingNamespace({
        command,
        context,
        stream,
        databaseName: metadataDatabaseName,
        collectionName: undefined,
      });

    return namespaceRequestChatResult({
      databaseName,
      collectionName,
      history: context.history,
    });
  }

  // @MongoDB /schema
  // eslint-disable-next-line complexity
  async handleSchemaRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<ChatResult> {
    if (!this._connectionController.getActiveDataService()) {
      return this._askToConnect({
        command: '/schema',
        context,
        stream,
      });
    }

    if (
      Prompts.isPromptEmpty(request) &&
      this._doesLastMessageAskForNamespace(context.history)
    ) {
      return this.handleEmptyNamespaceMessage({
        command: '/schema',
        context,
        stream,
      });
    }

    const namespace = await this._getNamespaceFromChat({
      request,
      context,
      token,
    });
    const { databaseName, collectionName } =
      await this._getOrAskForMissingNamespace({
        ...namespace,
        context,
        stream,
        command: '/schema',
      });

    // If either the database or collection name could not be automatically picked
    // then the user has been prompted to select one manually or been presented with an error.
    if (databaseName === undefined || collectionName === undefined) {
      return namespaceRequestChatResult({
        databaseName,
        collectionName,
        history: context.history,
      });
    }

    if (token.isCancellationRequested) {
      return this._handleCancelledRequest({
        context,
        stream,
      });
    }

    let sampleDocuments: Document[] | undefined;
    let amountOfDocumentsSampled: number;
    let schema: string | undefined;
    try {
      ({
        sampleDocuments,
        amountOfDocumentsSampled, // There can be fewer than the amount we attempt to sample.
        schema,
      } = await this._fetchCollectionSchemaAndSampleDocuments({
        databaseName,
        schemaFormat: 'full',
        collectionName,
        amountOfDocumentsToSample: DOCUMENTS_TO_SAMPLE_FOR_SCHEMA_PROMPT,
        token,
        stream,
      }));

      if (!schema || amountOfDocumentsSampled === 0) {
        stream.markdown(
          vscode.l10n.t(
            'Unable to generate a schema from the collection, no documents found.',
          ),
        );
        return schemaRequestChatResult(context.history);
      }
    } catch (e) {
      stream.markdown(
        vscode.l10n.t(
          `Unable to generate a schema from the collection, an error occurred: ${e}`,
        ),
      );
      return schemaRequestChatResult(context.history);
    }

    const modelInput = await Prompts.schema.buildMessages({
      request,
      context,
      databaseName,
      amountOfDocumentsSampled,
      collectionName,
      schema,
      connectionNames: this._getConnectionNames(),
      ...(sampleDocuments ? { sampleDocuments } : {}),
    });
    const response = await this.streamChatResponse({
      modelInput,
      stream,
      token,
    });

    stream.button({
      command: EXTENSION_COMMANDS.PARTICIPANT_OPEN_RAW_SCHEMA_OUTPUT,
      title: vscode.l10n.t('Open JSON Output'),
      arguments: [
        {
          schema,
        } as OpenSchemaCommandArgs,
      ],
    });

    this._telemetryService.track(
      new ParticipantResponseGeneratedTelemetryEvent({
        command: 'schema',
        hasCta: true,
        foundNamespace: true,
        hasRunnableContent: false,
        outputLength: response.outputLength,
      }),
    );

    return schemaRequestChatResult(context.history);
  }

  // @MongoDB /doctor what's wrong with my query to find offices with at least 100 employees?
  async handleDoctorRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<ChatResult> {
    if (!this._connectionController.getActiveDataService()) {
      return this._askToConnect({
        command: '/doctor',
        context,
        stream,
      });
    }

    if (Prompts.isPromptEmpty(request)) {
      if (this._doesLastMessageAskForNamespace(context.history)) {
        return this.handleEmptyNamespaceMessage({
          command: '/doctor',
          context,
          stream,
        });
      }

      stream.markdown(Prompts.doctor.emptyRequestResponse);
      return emptyRequestChatResult(context.history);
    }

    // Ask the model to parse for the database and collection name.
    // If they exist, we can then use them in our final completion.
    // When they don't exist we ask the user for them.
    const namespace = await this._getNamespaceFromChat({
      request,
      context,
      token,
    });
    const { databaseName, collectionName } =
      await this._getOrAskForMissingNamespace({
        ...namespace,
        context,
        stream,
        command: '/doctor',
      });

    // If either the database or collection name could not be automatically picked
    // then the user has been prompted to select one manually.
    if (databaseName === undefined || collectionName === undefined) {
      return namespaceRequestChatResult({
        databaseName,
        collectionName,
        history: context.history,
      });
    }

    if (token.isCancellationRequested) {
      return this._handleCancelledRequest({
        context,
        stream,
      });
    }

    // TODO try to access the user's Atlas credentials including an identifier for the connected
    // Atlas project. If not available, ask the user to provide. If they say no, we can try
    // to help without it.
    const schemaAdvice = await this._atlasApiController.fetchSchemaAdvice(
      '68225792a6c8ed0b4dc2a0d5',
      'Cluster0',
      stream,
    );
    log.info('Schema advice', { schemaAdvice });
    stream.markdown('```json\n' + JSON.stringify(schemaAdvice) + '\n```\n\n');

    let schema: string | undefined;
    let sampleDocuments: Document[] | undefined;
    try {
      ({ schema, sampleDocuments } =
        await this._fetchCollectionSchemaAndSampleDocuments({
          databaseName,
          collectionName,
          token,
          stream,
        }));
    } catch (e) {
      // When an error fetching the collection schema or sample docs occurs,
      // we still want to continue as it isn't critical, however,
      // we do want to notify the user.
      stream.markdown(
        vscode.l10n.t(
          'An error occurred while fetching the collection schema and sample documents.',
        ),
      );
    }

    const modelInput = await Prompts.doctor.buildMessages({
      request,
      context,
      databaseName,
      collectionName,
      schema,
      connectionNames: this._getConnectionNames(),
      ...(sampleDocuments ? { sampleDocuments } : {}),
    });

    await this.streamChatResponseContentWithCodeActions({
      modelInput,
      stream,
      token,
    });

    // We don't want telemetry for this very unofficial command.
    // this._telemetryService.track(
    //   new ParticipantResponseGeneratedTelemetryEvent({
    //     command: 'doctor',
    //     hasCta: false,
    //     foundNamespace: true,
    //     hasRunnableContent: hasCodeBlock,
    //     outputLength: outputLength,
    //   }),
    // );

    return doctorRequestChatResult(context.history);
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  async handleQueryRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<ChatResult> {
    if (!this._connectionController.getActiveDataService()) {
      return this._askToConnect({
        command: '/query',
        context,
        stream,
      });
    }

    if (Prompts.isPromptEmpty(request)) {
      if (this._doesLastMessageAskForNamespace(context.history)) {
        return this.handleEmptyNamespaceMessage({
          command: '/query',
          context,
          stream,
        });
      }

      stream.markdown(Prompts.query.emptyRequestResponse);
      return emptyRequestChatResult(context.history);
    }

    // We "prompt chain" to handle the query requests.
    // First we ask the model to parse for the database and collection name.
    // If they exist, we can then use them in our final completion.
    // When they don't exist we ask the user for them.
    const namespace = await this._getNamespaceFromChat({
      request,
      context,
      token,
    });
    const { databaseName, collectionName } =
      await this._getOrAskForMissingNamespace({
        ...namespace,
        context,
        stream,
        command: '/query',
      });

    // If either the database or collection name could not be automatically picked
    // then the user has been prompted to select one manually.
    if (databaseName === undefined || collectionName === undefined) {
      return namespaceRequestChatResult({
        databaseName,
        collectionName,
        history: context.history,
      });
    }

    if (token.isCancellationRequested) {
      return this._handleCancelledRequest({
        context,
        stream,
      });
    }

    let schema: string | undefined;
    let sampleDocuments: Document[] | undefined;
    try {
      ({ schema, sampleDocuments } =
        await this._fetchCollectionSchemaAndSampleDocuments({
          databaseName,
          collectionName,
          token,
          stream,
        }));
    } catch (e) {
      // When an error fetching the collection schema or sample docs occurs,
      // we still want to continue as it isn't critical, however,
      // we do want to notify the user.
      stream.markdown(
        vscode.l10n.t(
          'An error occurred while fetching the collection schema and sample documents.\nThe generated query will not be able to reference the shape of your data.',
        ),
      );
    }

    const modelInput = await Prompts.query.buildMessages({
      request,
      context,
      databaseName,
      collectionName,
      schema,
      connectionNames: this._getConnectionNames(),
      ...(sampleDocuments ? { sampleDocuments } : {}),
    });

    const { hasCodeBlock, outputLength } =
      await this.streamChatResponseContentWithCodeActions({
        modelInput,
        stream,
        token,
      });

    this._telemetryService.track(
      new ParticipantResponseGeneratedTelemetryEvent({
        command: 'query',
        hasCta: false,
        foundNamespace: true,
        hasRunnableContent: hasCodeBlock,
        outputLength: outputLength,
      }),
    );

    return queryRequestChatResult(context.history);
  }

  async _handleDocsRequestWithChatbot({
    request,
    chatId,
    token,
    stream,
    context,
  }: {
    chatId: string;
    token: vscode.CancellationToken;
    context: vscode.ChatContext;
    request: vscode.ChatRequest;
    stream: vscode.ChatResponseStream;
  }): Promise<{
    responseContent: string;
    responseReferences?: Reference[];
    docsChatbotMessageId: string;
  }> {
    const prompt = request.prompt;
    stream.push(
      new vscode.ChatResponseProgressPart(
        'Consulting MongoDB documentation...',
      ),
    );

    let { docsChatbotConversationId } =
      this._chatMetadataStore.getChatMetadata(chatId) ?? {};
    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });
    if (!docsChatbotConversationId) {
      const conversation = await this._docsChatbotAIService.createConversation({
        signal: abortController.signal,
      });
      docsChatbotConversationId = conversation._id;
      this._chatMetadataStore.setChatMetadata(chatId, {
        docsChatbotConversationId,
      });
      log.info('Docs chatbot created for chatId', chatId);
    }

    const history = await PromptHistory.getFilteredHistoryForDocs({
      connectionNames: this._getConnectionNames(),
      context: context,
    });

    const previousMessages =
      history.length > 0
        ? `${history
            .map((message: vscode.LanguageModelChatMessage) =>
              getContent(message),
            )
            .join('\n\n')}\n\n`
        : '';

    const response = await this._docsChatbotAIService.addMessage({
      message: `${previousMessages}${prompt}`,
      conversationId: docsChatbotConversationId,
      signal: abortController.signal,
    });

    const stats = Prompts.docs.getStats(history, { request, context });

    this._telemetryService.track(
      new ParticipantPromptSubmittedTelemetryEvent(stats),
    );

    log.info('Docs chatbot message sent', {
      chatId,
      docsChatbotConversationId,
      docsChatbotMessageId: response.id,
    });

    return {
      responseContent: response.content,
      responseReferences: response.references,
      docsChatbotMessageId: response.id,
    };
  }

  async _handleDocsRequestWithCopilot(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken,
    ]
  ): Promise<void> {
    const [request, context, stream, token] = args;
    const modelInput = await Prompts.generic.buildMessages({
      request,
      context,
      connectionNames: this._getConnectionNames(),
    });

    const { hasCodeBlock, outputLength } =
      await this.streamChatResponseContentWithCodeActions({
        modelInput,
        stream,
        token,
      });

    this._streamGenericDocsLink(stream);

    this._telemetryService.track(
      new ParticipantResponseGeneratedTelemetryEvent({
        command: 'docs/copilot',
        hasCta: true,
        foundNamespace: false,
        hasRunnableContent: hasCodeBlock,
        outputLength: outputLength,
      }),
    );
  }

  _streamResponseReference({
    reference,
    stream,
  }: {
    reference: Reference;
    stream: vscode.ChatResponseStream;
  }): void {
    const link = new vscode.MarkdownString(
      `- [${reference.title}](${reference.url})\n`,
    );
    link.supportHtml = true;
    stream.markdown(link);
  }

  _streamGenericDocsLink(stream: vscode.ChatResponseStream): void {
    this._streamResponseReference({
      reference: {
        url: MONGODB_DOCS_LINK,
        title: 'View MongoDB documentation',
      },
      stream,
    });
  }

  async handleDocsRequest(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken,
    ]
  ): Promise<ChatResult> {
    const [request, context, stream, token] = args;

    if (Prompts.isPromptEmpty(request)) {
      stream.markdown(Prompts.generic.getEmptyRequestResponse());
      this._streamGenericDocsLink(stream);
      return emptyRequestChatResult(context.history);
    }

    const chatId = ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
      context.history,
    );
    let docsResult: {
      responseContent?: string;
      responseReferences?: Reference[];
      docsChatbotMessageId?: string;
    } = {};

    try {
      docsResult = await this._handleDocsRequestWithChatbot({
        request,
        chatId,
        token,
        stream,
        context,
      });

      if (docsResult.responseContent) {
        stream.markdown(docsResult.responseContent);
      }

      if (docsResult.responseReferences) {
        for (const reference of docsResult.responseReferences) {
          this._streamResponseReference({
            reference,
            stream,
          });
        }
      }

      this._telemetryService.track(
        new ParticipantResponseGeneratedTelemetryEvent({
          command: 'docs/chatbot',
          hasCta: !!docsResult.responseReferences,
          foundNamespace: false,
          hasRunnableContent: false,
          outputLength: docsResult.responseContent?.length ?? 0,
        }),
      );
    } catch (error) {
      // If the docs chatbot API is not available, fall back to Copilot’s LLM and include
      // the MongoDB documentation link for users to go to our documentation site directly.
      log.error(error);

      if (token.isCancellationRequested) {
        return this._handleCancelledRequest({
          context,
          stream,
        });
      }

      this._telemetryService.track(
        new ParticipantResponseFailedTelemetryEvent(
          'docs',
          ParticipantErrorTypes.DOCS_CHATBOT_API,
        ),
      );

      await this._handleDocsRequestWithCopilot(...args);
    }

    return docsRequestChatResult({
      chatId,
      docsChatbotMessageId: docsResult.docsChatbotMessageId,
    });
  }

  async selectLanguageWithQuickPick(): Promise<string | undefined> {
    const targetLanguages = EXPORT_TO_LANGUAGE_ALIASES.map(
      ({ alias }) => alias,
    );
    const selectedQuickPickItem = await vscode.window.showQuickPick(
      targetLanguages,
      {
        placeHolder: 'Export to...',
      },
    );
    return selectedQuickPickItem;
  }

  async selectTargetForExportToLanguage(): Promise<boolean> {
    const languageAlias = await this.selectLanguageWithQuickPick();
    const language = EXPORT_TO_LANGUAGE_ALIASES.find(
      (item) => item.alias === languageAlias,
    );
    if (!language) {
      return false;
    }
    await vscode.commands.executeCommand(
      EXTENSION_COMMANDS.MDB_EXPORT_TO_LANGUAGE,
      language.id,
    );
    return true;
  }

  async exportCodeToPlayground(): Promise<boolean> {
    const codeToExport = getSelectedText() || getAllText();

    try {
      const contentOrError = await vscode.window.withProgress<
        { value: string } | { error: ExportToPlaygroundError }
      >(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Exporting code to a playground...',
          cancellable: true,
        },
        async (
          progress,
          token,
        ): Promise<{ value: string } | { error: ExportToPlaygroundError }> => {
          let modelInput: ModelInput | undefined;
          try {
            modelInput = await Prompts.exportToPlayground.buildMessages({
              request: { prompt: codeToExport },
            });
          } catch (error) {
            return { error: 'modelInput' };
          }

          const result = await Promise.race([
            this.streamChatResponseWithExportToLanguage({
              modelInput,
              token,
            }),
            new Promise<ExportToPlaygroundError>((resolve) =>
              token.onCancellationRequested(() => {
                log.info('The export to a playground operation was canceled.');
                resolve('cancelled');
              }),
            ),
          ]);

          if (result === 'cancelled') {
            return { error: 'cancelled' };
          }

          if (!result || result?.includes("Sorry, I can't assist with that.")) {
            return { error: 'streamChatResponseWithExportToLanguage' };
          }

          return { value: result };
        },
      );

      if ('error' in contentOrError) {
        const { error } = contentOrError;
        if (error === 'cancelled') {
          return true;
        }

        void vscode.window.showErrorMessage(
          'Failed to generate a MongoDB Playground. Please ensure your code block contains a MongoDB query.',
        );

        // Content in this case is already equal to the failureType; this is just to make it explicit
        // and avoid accidentally sending actual contents of the message.
        this._telemetryService.track(
          new ExportToPlaygroundFailedTelemetryEvent(
            codeToExport?.length,
            error,
          ),
        );
        return false;
      }

      const content = contentOrError.value;
      await vscode.commands.executeCommand(
        EXTENSION_COMMANDS.OPEN_PARTICIPANT_CODE_IN_PLAYGROUND,
        {
          runnableContent: content,
        },
      );

      return true;
    } catch (error) {
      const message = formatError(error).message;
      this._telemetryService.trackParticipantError(error, 'exportToPlayground');
      void vscode.window.showErrorMessage(
        `An error occurred exporting to a playground: ${message}`,
      );
      return false;
    }
  }

  async _exportPlaygroundToLanguageWithCancelModal({
    prompt,
    language,
    includeDriverSyntax,
  }: {
    prompt: string;
    language: string;
    includeDriverSyntax: boolean;
  }): Promise<string | null> {
    const languageById = EXPORT_TO_LANGUAGE_ALIASES.find(
      (item) => item.id === language,
    );
    const progressResult = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Exporting playground to ${languageById?.alias || language}...`,
        cancellable: true,
      },
      async (progress, token): Promise<string | null> => {
        const modelInput = await Prompts.exportToLanguage.buildMessages({
          request: { prompt },
          language,
          includeDriverSyntax,
        });
        const result = await Promise.race([
          this.streamChatResponseWithExportToLanguage({
            modelInput,
            token,
            language,
          }),
          new Promise<null>((resolve) =>
            token.onCancellationRequested(() => {
              log.info(`The export to ${language} operation was canceled.`);
              resolve(null);
            }),
          ),
        ]);

        if (result?.includes("Sorry, I can't assist with that.")) {
          void vscode.window.showErrorMessage(
            `Sorry, we were unable to export code to the "${language}" language, please try again. If the error persists, try changing your selected code.`,
          );
          return null;
        }

        return result || null;
      },
    );

    return progressResult;
  }

  async chatHandler(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken,
    ]
  ): Promise<ChatResult> {
    const [request, , stream] = args;
    try {
      const hasBeenShownWelcomeMessageAlready = !!this._storageController.get(
        StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE,
      );
      if (!hasBeenShownWelcomeMessageAlready) {
        stream.markdown(
          vscode.l10n.t(`
Welcome to MongoDB Participant!\n\n
Interact with your MongoDB clusters and generate MongoDB-related code more efficiently with intelligent AI-powered feature, available today in the MongoDB extension.\n\n
Please see our [FAQ](https://www.mongodb.com/docs/generative-ai-faq/) for more information.\n\n`),
        );

        this._telemetryService.track(
          new ParticipantWelcomeShownTelemetryEvent(),
        );

        await this._storageController.update(
          StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE,
          true,
        );
      }

      switch (request.command) {
        case 'query':
          return await this.handleQueryRequest(...args);
        case 'docs':
          return await this.handleDocsRequest(...args);
        case 'schema':
          return await this.handleSchemaRequest(...args);
        default:
          if (!request.prompt?.trim()) {
            stream.markdown(Prompts.generic.getEmptyRequestResponse());
            return emptyRequestChatResult(args[1].history);
          }

          return await this.handleGenericRequest(...args);
      }
    } catch (error) {
      this._telemetryService.trackParticipantError(
        error,
        (request.command as ParticipantCommandType) || 'generic',
      );
      // Re-throw other errors so they show up in the UI.
      throw error;
    }
  }

  async _rateDocsChatbotMessage(
    feedback: vscode.ChatResultFeedback,
  ): Promise<void> {
    const chatId = feedback.result.metadata?.chatId;
    if (!chatId) {
      return;
    }

    const { docsChatbotConversationId } =
      this._chatMetadataStore.getChatMetadata(chatId) ?? {};
    if (
      !docsChatbotConversationId ||
      !feedback.result.metadata?.docsChatbotMessageId
    ) {
      return;
    }

    try {
      const rating = await this._docsChatbotAIService.rateMessage({
        conversationId: docsChatbotConversationId,
        messageId: feedback.result.metadata?.docsChatbotMessageId,
        rating: !!feedback.kind,
      });
      log.info('Docs chatbot rating sent', rating);
    } catch (error) {
      log.error(error);
    }
  }

  async handleUserFeedback(feedback: vscode.ChatResultFeedback): Promise<void> {
    if (feedback.result.metadata?.intent === 'docs') {
      await this._rateDocsChatbotMessage(feedback);
    }

    // unhelpfulReason is available in insider builds and is accessed through
    // https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.chatParticipantAdditions.d.ts
    // Since this is a proposed API, we can't depend on it being available, which is why
    // we're dynamically checking for it.
    const unhelpfulReason =
      'unhelpfulReason' in feedback
        ? (feedback.unhelpfulReason as string)
        : undefined;
    this._telemetryService.track(
      new ParticipantFeedbackTelemetryEvent(
        feedback.kind,
        (feedback.result as ChatResult)?.metadata.intent,
        unhelpfulReason,
      ),
    );
  }

  _getConnectionNames(): string[] {
    return this._connectionController
      .getSavedConnections()
      .map((connection) => connection.name);
  }

  async changeDriverSyntaxForExportToLanguage(
    includeDriverSyntax: boolean,
  ): Promise<boolean> {
    if (
      !this._playgroundResultProvider._playgroundResult ||
      !isExportToLanguageResult(
        this._playgroundResultProvider._playgroundResult,
      )
    ) {
      void vscode.window.showErrorMessage(
        'Unable to change the driver syntax, no playground content found.',
      );
      return false;
    }

    const { prompt, language } =
      this._playgroundResultProvider._playgroundResult;
    return this._transpile({ prompt, language, includeDriverSyntax });
  }

  async exportPlaygroundToLanguage(language: string): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;

    if (!isPlayground(editor?.document.uri)) {
      void vscode.window.showErrorMessage(
        'Please select one or more lines in the playground.',
      );
      return false;
    }

    const selectedText = getSelectedText();
    const prompt = selectedText || getAllText();
    let includeDriverSyntax = DEFAULT_EXPORT_TO_LANGUAGE_DRIVER_SYNTAX;

    if (
      this._playgroundResultProvider._playgroundResult &&
      isExportToLanguageResult(this._playgroundResultProvider._playgroundResult)
    ) {
      includeDriverSyntax =
        this._playgroundResultProvider._playgroundResult.includeDriverSyntax;
    }

    return this._transpile({ prompt, language, includeDriverSyntax });
  }

  async _transpile({
    prompt,
    language,
    includeDriverSyntax,
  }: {
    prompt: string;
    language: string;
    includeDriverSyntax: boolean;
  }): Promise<boolean> {
    log.info(`Exporting to the '${language}' language.`);

    try {
      const transpiledContent =
        await this._exportPlaygroundToLanguageWithCancelModal({
          prompt,
          language,
          includeDriverSyntax,
        });

      if (!transpiledContent) {
        return false;
      }

      log.info(`The playground was exported to ${language}`, {
        prompt,
        language,
        includeDriverSyntax,
      });

      this._telemetryService.track(
        new PlaygroundExportedToLanguageTelemetryEvent(
          language,
          transpiledContent?.length,
          includeDriverSyntax,
        ),
      );

      await vscode.commands.executeCommand(
        EXTENSION_COMMANDS.SHOW_EXPORT_TO_LANGUAGE_RESULT,
        {
          prompt,
          content: transpiledContent,
          language,
          includeDriverSyntax,
        },
      );
    } catch (error) {
      log.error(`Export to ${language} failed`, error);
      const printableError = formatError(error);
      const languageById = EXPORT_TO_LANGUAGE_ALIASES.find(
        (item) => item.id === language,
      );
      void vscode.window.showErrorMessage(
        `Unable to export to ${languageById?.alias || language}: ${
          printableError.message
        }`,
      );
    }

    return true;
  }
}
