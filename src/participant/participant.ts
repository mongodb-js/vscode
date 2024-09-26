import * as vscode from 'vscode';
import { getSimplifiedSchema, parseSchema } from 'mongodb-schema';
import type { Document } from 'bson';
import type { Reference } from 'mongodb-rag-core';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import type { LoadedConnection } from '../storage/connectionStorage';
import EXTENSION_COMMANDS from '../commands';
import type { StorageController } from '../storage';
import { StorageVariables } from '../storage';
import { Prompts } from './prompts';
import type { ChatResult } from './constants';
import {
  askToConnectChatResult,
  CHAT_PARTICIPANT_ID,
  emptyRequestChatResult,
  genericRequestChatResult,
  namespaceRequestChatResult,
  queryRequestChatResult,
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
  chatResultFeedbackKindToTelemetryValue,
  ParticipantErrorTypes,
  TelemetryEventTypes,
} from '../telemetry/telemetryService';
import { DocsChatbotAIService } from './docsChatbotAIService';
import type TelemetryService from '../telemetry/telemetryService';
import { processStreamWithIdentifiers } from './streamParsing';
import type { PromptIntent } from './prompts/intent';

const log = createLogger('participant');

const NUM_DOCUMENTS_TO_SAMPLE = 3;

const MONGODB_DOCS_LINK = 'https://www.mongodb.com/docs/';

interface NamespaceQuickPicks {
  label: string;
  data: string;
}

export type RunParticipantQueryCommandArgs = {
  runnableContent: string;
};

export type ParticipantCommand = '/query' | '/schema' | '/docs';

const MAX_MARKDOWN_LIST_LENGTH = 10;

export default class ParticipantController {
  _participant?: vscode.ChatParticipant;
  _connectionController: ConnectionController;
  _storageController: StorageController;
  _chatMetadataStore: ChatMetadataStore;
  _docsChatbotAIService: DocsChatbotAIService;
  _telemetryService: TelemetryService;

  constructor({
    connectionController,
    storageController,
    telemetryService,
  }: {
    connectionController: ConnectionController;
    storageController: StorageController;
    telemetryService: TelemetryService;
  }) {
    this._connectionController = connectionController;
    this._storageController = storageController;
    this._chatMetadataStore = new ChatMetadataStore();
    this._telemetryService = telemetryService;
    this._docsChatbotAIService = new DocsChatbotAIService();
  }

  createParticipant(context: vscode.ExtensionContext): vscode.ChatParticipant {
    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    this._participant = vscode.chat.createChatParticipant(
      CHAT_PARTICIPANT_ID,
      this.chatHandler.bind(this)
    );
    this._participant.iconPath = vscode.Uri.joinPath(
      vscode.Uri.parse(context.extensionPath),
      'images',
      'mongodb.png'
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

  handleError(err: any, command: string): never {
    let errorCode: string | undefined;
    let errorName: ParticipantErrorTypes;
    // Making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quote limits exceeded
    if (err instanceof vscode.LanguageModelError) {
      errorCode = err.code;
    }

    if (err instanceof Error) {
      // Unwrap the error if a cause is provided
      err = err.cause || err;
    }

    const message: string = err.message || err.toString();

    if (message.includes('off_topic')) {
      errorName = ParticipantErrorTypes.CHAT_MODEL_OFF_TOPIC;
    } else if (message.includes('Filtered by Responsible AI Service')) {
      errorName = ParticipantErrorTypes.FILTERED;
    } else if (message.includes('Prompt failed validation')) {
      errorName = ParticipantErrorTypes.INVALID_PROMPT;
    } else {
      errorName = ParticipantErrorTypes.OTHER;
    }

    this._telemetryService.track(
      TelemetryEventTypes.PARTICIPANT_RESPONSE_FAILED,
      {
        command,
        error_code: errorCode,
        error_name: errorName,
      }
    );

    // Re-throw other errors so they show up in the UI.
    throw err;
  }

  /**
   * In order to get access to the model, and to write more messages to the chat after
   * an async event that occurs after we've already completed our response, we need
   * to be handling a chat request. This could be when a user clicks a button or link
   * in the chat. To work around this, we can write a message as the user, which will
   * trigger the chat handler and give us access to the model.
   */
  writeChatMessageAsUser(message: string): Thenable<unknown> {
    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB ${message}`,
    });
  }

  async _getChatResponse({
    messages,
    token,
  }: {
    messages: vscode.LanguageModelChatMessage[];
    token: vscode.CancellationToken;
  }): Promise<vscode.LanguageModelChatResponse> {
    const model = await getCopilotModel();

    if (!model) {
      throw new Error('Copilot model not found');
    }

    return await model.sendRequest(messages, {}, token);
  }

  async streamChatResponse({
    messages,
    stream,
    token,
  }: {
    messages: vscode.LanguageModelChatMessage[];
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }): Promise<void> {
    const chatResponse = await this._getChatResponse({
      messages,
      token,
    });
    for await (const fragment of chatResponse.text) {
      stream.markdown(fragment);
    }
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

    const commandArgs: RunParticipantQueryCommandArgs = {
      runnableContent,
    };
    stream.button({
      command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
      title: vscode.l10n.t('▶️ Run'),
      arguments: [commandArgs],
    });
    stream.button({
      command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
      title: vscode.l10n.t('Open in playground'),
      arguments: [commandArgs],
    });
  }

  async streamChatResponseContentWithCodeActions({
    messages,
    stream,
    token,
  }: {
    messages: vscode.LanguageModelChatMessage[];
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }): Promise<void> {
    const chatResponse = await this._getChatResponse({
      messages,
      token,
    });

    await processStreamWithIdentifiers({
      processStreamFragment: (fragment: string) => {
        stream.markdown(fragment);
      },
      onStreamIdentifier: (content: string) => {
        this._streamCodeBlockActions({ runnableContent: content, stream });
      },
      inputIterable: chatResponse.text,
      identifier: codeBlockIdentifier,
    });
  }

  // This will stream all of the response content and create a string from it.
  // It should only be used when the entire response is needed at one time.
  async getChatResponseContent({
    messages,
    token,
  }: {
    messages: vscode.LanguageModelChatMessage[];
    token: vscode.CancellationToken;
  }): Promise<string> {
    let responseContent = '';
    const chatResponse = await this._getChatResponse({
      messages,
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
    token: vscode.CancellationToken
  ): Promise<ChatResult> {
    const messages = await Prompts.generic.buildMessages({
      request,
      context,
      connectionNames: this._getConnectionNames(),
    });

    await this.streamChatResponseContentWithCodeActions({
      messages,
      token,
      stream,
    });

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
      default:
        return this._handleRoutedGenericRequest(
          request,
          context,
          stream,
          token
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
    const messages = await Prompts.intent.buildMessages({
      connectionNames: this._getConnectionNames(),
      request,
      context,
    });

    const responseContent = await this.getChatResponseContent({
      messages,
      token,
    });

    return Prompts.intent.getIntentFromModelResponse(responseContent);
  }

  async handleGenericRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
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

    return this.writeChatMessageAsUser(
      `${command ? `${command} ` : ''}${connectionName}`
    ) as Promise<boolean>;
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
          })
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
    command: ParticipantCommand
  ): Promise<NamespaceQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      // Run a blank command to get the user to connect first.
      void this.writeChatMessageAsUser(command);
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
    command: ParticipantCommand
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

    return this.writeChatMessageAsUser(
      `${command} ${databaseName}`
    ) as Promise<boolean>;
  }

  async getCollectionQuickPicks({
    command,
    databaseName,
  }: {
    command: ParticipantCommand;
    databaseName: string;
  }): Promise<NamespaceQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      // Run a blank command to get the user to connect first.
      void this.writeChatMessageAsUser(command);
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
      }
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
    return this.writeChatMessageAsUser(
      `${command} ${collectionName}`
    ) as Promise<boolean>;
  }

  async renderDatabasesTree({
    command,
    context,
    stream,
  }: {
    command: ParticipantCommand;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
  }): Promise<void> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return;
    }

    stream.push(
      new vscode.ChatResponseProgressPart('Fetching database names...')
    );

    try {
      const databases = await dataService.listDatabases({
        nameOnly: true,
      });
      databases.slice(0, MAX_MARKDOWN_LIST_LENGTH).forEach((db) =>
        stream.markdown(
          createMarkdownLink({
            commandId: EXTENSION_COMMANDS.SELECT_DATABASE_WITH_PARTICIPANT,
            data: {
              command,
              chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
                context.history
              ),
              databaseName: db.name,
            },
            name: db.name,
          })
        )
      );
      if (databases.length > MAX_MARKDOWN_LIST_LENGTH) {
        stream.markdown(
          createMarkdownLink({
            data: {
              command,
              chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
                context.history
              ),
            },
            commandId: EXTENSION_COMMANDS.SELECT_DATABASE_WITH_PARTICIPANT,
            name: 'Show more',
          })
        );
      }
    } catch (error) {
      log.error('Unable to fetch databases:', error);

      // Users can always do this manually when asked to provide a database name.
      return;
    }
  }

  async renderCollectionsTree({
    command,
    context,
    databaseName,
    stream,
  }: {
    command: ParticipantCommand;
    databaseName: string;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
  }): Promise<void> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return;
    }

    stream.push(
      new vscode.ChatResponseProgressPart('Fetching collection names...')
    );

    try {
      const collections = await dataService.listCollections(databaseName);
      collections.slice(0, MAX_MARKDOWN_LIST_LENGTH).forEach((coll) =>
        stream.markdown(
          createMarkdownLink({
            commandId: EXTENSION_COMMANDS.SELECT_COLLECTION_WITH_PARTICIPANT,
            data: {
              command,
              chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
                context.history
              ),
              databaseName,
              collectionName: coll.name,
            },
            name: coll.name,
          })
        )
      );
      if (collections.length > MAX_MARKDOWN_LIST_LENGTH) {
        stream.markdown(
          createMarkdownLink({
            commandId: EXTENSION_COMMANDS.SELECT_COLLECTION_WITH_PARTICIPANT,
            data: {
              command,
              chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
                context.history
              ),
              databaseName,
            },
            name: 'Show more',
          })
        );
      }
    } catch (error) {
      log.error('Unable to fetch collections:', error);

      // Users can always do this manually when asked to provide a collection name.
      return;
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
    const responseContentWithNamespace = await this.getChatResponseContent({
      messages: messagesWithNamespace,
      token,
    });
    const { databaseName, collectionName } =
      Prompts.namespace.extractDatabaseAndCollectionNameFromResponse(
        responseContentWithNamespace
      );

    // See if there's a namespace set in the
    // chat metadata we can fallback to if the model didn't find it.
    const chatId = ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
      context.history
    );
    const {
      databaseName: databaseNameFromMetadata,
      collectionName: collectionNameFromMetadata,
    } = this._chatMetadataStore.getChatMetadata(chatId) ?? {};

    return {
      databaseName: databaseName || databaseNameFromMetadata,
      collectionName: collectionName || collectionNameFromMetadata,
    };
  }

  async _askForNamespace({
    command,
    context,
    databaseName,
    collectionName,
    stream,
  }: {
    command: ParticipantCommand;
    context: vscode.ChatContext;
    databaseName: string | undefined;
    collectionName: string | undefined;
    stream: vscode.ChatResponseStream;
  }): Promise<ChatResult> {
    // If no database or collection name is found in the user prompt,
    // we retrieve the available namespaces from the current connection.
    // Users can then select a value by clicking on an item in the list.
    if (!databaseName) {
      stream.markdown(
        `What is the name of the database you would like${
          command === '/query' ? ' this query' : ''
        } to run against?\n\n`
      );
      await this.renderDatabasesTree({
        command,
        context,
        stream,
      });
    } else if (!collectionName) {
      stream.markdown(
        `Which collection would you like to use within ${databaseName}?\n\n`
      );
      await this.renderCollectionsTree({
        command,
        databaseName,
        context,
        stream,
      });
    }

    return namespaceRequestChatResult({
      databaseName,
      collectionName,
      history: context.history,
    });
  }

  _doesLastMessageAskForNamespace(
    history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
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
    stream.markdown(
      "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n"
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
        'Fetching documents and analyzing schema...'
      )
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
        }
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
    const databaseName = lastMessage.metadata.databaseName;
    if (databaseName) {
      stream.markdown(
        vscode.l10n.t(
          'Please select a collection by either clicking on an item in the list or typing the name manually in the chat.'
        )
      );
      await this.renderCollectionsTree({
        command,
        databaseName,
        context,
        stream,
      });
    } else {
      stream.markdown(
        vscode.l10n.t(
          'Please select a database by either clicking on an item in the list or typing the name manually in the chat.'
        )
      );
      await this.renderDatabasesTree({
        command,
        context,
        stream,
      });
    }

    return namespaceRequestChatResult({
      databaseName,
      collectionName: undefined,
      history: context.history,
    });
  }

  // @MongoDB /schema
  async handleSchemaRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
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

    const { databaseName, collectionName } = await this._getNamespaceFromChat({
      request,
      context,
      token,
    });
    if (!databaseName || !collectionName) {
      return await this._askForNamespace({
        command: '/schema',
        context,
        databaseName,
        collectionName,
        stream,
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
            'Unable to generate a schema from the collection, no documents found.'
          )
        );
        return schemaRequestChatResult(context.history);
      }
    } catch (e) {
      stream.markdown(
        vscode.l10n.t(
          `Unable to generate a schema from the collection, an error occurred: ${e}`
        )
      );
      return schemaRequestChatResult(context.history);
    }

    const messages = await Prompts.schema.buildMessages({
      request,
      context,
      databaseName,
      amountOfDocumentsSampled,
      collectionName,
      schema,
      connectionNames: this._getConnectionNames(),
      ...(sampleDocuments ? { sampleDocuments } : {}),
    });
    await this.streamChatResponse({
      messages,
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

    return schemaRequestChatResult(context.history);
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  async handleQueryRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
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
    const { databaseName, collectionName } = await this._getNamespaceFromChat({
      request,
      context,
      token,
    });
    if (!databaseName || !collectionName) {
      return await this._askForNamespace({
        command: '/query',
        context,
        databaseName,
        collectionName,
        stream,
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
          'An error occurred while fetching the collection schema and sample documents.\nThe generated query will not be able to reference the shape of your data.'
        )
      );
    }

    const messages = await Prompts.query.buildMessages({
      request,
      context,
      databaseName,
      collectionName,
      schema,
      connectionNames: this._getConnectionNames(),
      ...(sampleDocuments ? { sampleDocuments } : {}),
    });

    await this.streamChatResponseContentWithCodeActions({
      messages,
      stream,
      token,
    });

    return queryRequestChatResult(context.history);
  }

  async _handleDocsRequestWithChatbot({
    prompt,
    chatId,
    token,
    stream,
  }: {
    prompt: string;
    chatId: string;
    token: vscode.CancellationToken;
    stream: vscode.ChatResponseStream;
  }): Promise<{
    responseContent: string;
    responseReferences?: Reference[];
    docsChatbotMessageId: string;
  }> {
    stream.push(
      new vscode.ChatResponseProgressPart('Consulting MongoDB documentation...')
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

    const response = await this._docsChatbotAIService.addMessage({
      message: prompt,
      conversationId: docsChatbotConversationId,
      signal: abortController.signal,
    });

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
      vscode.CancellationToken
    ]
  ): Promise<void> {
    const [request, context, stream, token] = args;
    const messages = await Prompts.generic.buildMessages({
      request,
      context,
      connectionNames: this._getConnectionNames(),
    });

    await this.streamChatResponseContentWithCodeActions({
      messages,
      stream,
      token,
    });

    this._streamResponseReference({
      reference: {
        url: MONGODB_DOCS_LINK,
        title: 'View MongoDB documentation',
      },
      stream,
    });
  }

  _streamResponseReference({
    reference,
    stream,
  }: {
    reference: Reference;
    stream: vscode.ChatResponseStream;
  }): void {
    const link = new vscode.MarkdownString(
      `- [${reference.title}](${reference.url})\n`
    );
    link.supportHtml = true;
    stream.markdown(link);
  }

  async handleDocsRequest(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken
    ]
  ): Promise<ChatResult> {
    const [request, context, stream, token] = args;

    const chatId = ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
      context.history
    );
    let docsResult: {
      responseContent?: string;
      responseReferences?: Reference[];
      docsChatbotMessageId?: string;
    } = {};

    try {
      docsResult = await this._handleDocsRequestWithChatbot({
        prompt: request.prompt,
        chatId,
        token,
        stream,
      });

      if (docsResult.responseReferences) {
        for (const reference of docsResult.responseReferences) {
          this._streamResponseReference({
            reference,
            stream,
          });
        }
      }

      if (docsResult.responseContent) {
        stream.markdown(docsResult.responseContent);
      }
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
        TelemetryEventTypes.PARTICIPANT_RESPONSE_FAILED,
        {
          command: 'docs',
          error_name: ParticipantErrorTypes.DOCS_CHATBOT_API,
        }
      );

      await this._handleDocsRequestWithCopilot(...args);
    }

    return docsRequestChatResult({
      chatId,
      docsChatbotMessageId: docsResult.docsChatbotMessageId,
    });
  }

  async chatHandler(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken
    ]
  ): Promise<ChatResult> {
    const [request, , stream] = args;
    try {
      const hasBeenShownWelcomeMessageAlready = !!this._storageController.get(
        StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE
      );
      if (!hasBeenShownWelcomeMessageAlready) {
        stream.markdown(
          vscode.l10n.t(`
Welcome to MongoDB Participant!\n\n
Interact with your MongoDB clusters and generate MongoDB-related code more efficiently with intelligent AI-powered feature, available today in the MongoDB extension.\n\n
Please see our [FAQ](https://www.mongodb.com/docs/generative-ai-faq/) for more information.\n\n`)
        );

        this._telemetryService.track(
          TelemetryEventTypes.PARTICIPANT_WELCOME_SHOWN
        );

        await this._storageController.update(
          StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE,
          true
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
    } catch (e) {
      this.handleError(e, request.command || 'generic');
    }
  }

  async _rateDocsChatbotMessage(
    feedback: vscode.ChatResultFeedback
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
    this._telemetryService.trackCopilotParticipantFeedback({
      feedback: chatResultFeedbackKindToTelemetryValue(feedback.kind),
      reason: feedback.unhelpfulReason,
      response_type: (feedback.result as ChatResult)?.metadata.intent,
    });
  }

  _getConnectionNames(): string[] {
    return this._connectionController
      .getSavedConnections()
      .map((connection) => connection.name);
  }
}
