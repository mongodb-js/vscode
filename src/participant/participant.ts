import * as vscode from 'vscode';
import { getSimplifiedSchema } from 'mongodb-schema';
import type { Document } from 'bson';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import type { LoadedConnection } from '../storage/connectionStorage';
import EXTENSION_COMMANDS from '../commands';
import type { StorageController } from '../storage';
import { StorageVariables } from '../storage';
import { GenericPrompt } from './prompts/generic';
import type { ChatResult } from './constants';
import {
  askToConnectChatResult,
  CHAT_PARTICIPANT_ID,
  emptyRequestChatResult,
  genericRequestChatResult,
  namespaceRequestChatResult,
  queryRequestChatResult,
  docsRequestChatResult,
} from './constants';
import { QueryPrompt } from './prompts/query';
import { COL_NAME_ID, DB_NAME_ID, NamespacePrompt } from './prompts/namespace';
import { SchemaFormatter } from './schema';
import { getSimplifiedSampleDocuments } from './sampleDocuments';
import { getCopilotModel } from './model';
import { createMarkdownLink } from './markdown';
import { ChatMetadataStore } from './chatMetadata';
import { DocsChatbotAIService } from './docsChatbotAIService';
import {
  chatResultFeedbackKindToTelemetryValue,
  ParticipantErrorTypes,
  TelemetryEventTypes,
} from '../telemetry/telemetryService';
import type TelemetryService from '../telemetry/telemetryService';
import type { Reference } from 'mongodb-rag-core';

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

const DB_NAME_REGEX = `${DB_NAME_ID}: (.*)`;
const COL_NAME_REGEX = `${COL_NAME_ID}: (.*)`;

const MAX_MARKDOWN_LIST_LENGTH = 10;

export function parseForDatabaseAndCollectionName(text: string): {
  databaseName?: string;
  collectionName?: string;
} {
  const databaseName = text.match(DB_NAME_REGEX)?.[1].trim();
  const collectionName = text.match(COL_NAME_REGEX)?.[1].trim();
  return { databaseName, collectionName };
}

export function getRunnableContentFromString(text: string): string {
  const matchedJSresponseContent = text.match(/```javascript((.|\n)*)```/);

  const code =
    matchedJSresponseContent && matchedJSresponseContent.length > 1
      ? matchedJSresponseContent[1]
      : '';
  return code.trim();
}

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

  async getChatResponseContent({
    messages,
    token,
  }: {
    messages: vscode.LanguageModelChatMessage[];
    token: vscode.CancellationToken;
  }): Promise<string> {
    const model = await getCopilotModel();
    let responseContent = '';
    if (model) {
      const chatResponse = await model.sendRequest(messages, {}, token);
      for await (const fragment of chatResponse.text) {
        responseContent += fragment;
      }
    }

    return responseContent;
  }

  _streamRunnableContentActions({
    responseContent,
    stream,
  }: {
    responseContent: string;
    stream: vscode.ChatResponseStream;
  }): void {
    const runnableContent = getRunnableContentFromString(responseContent);
    if (runnableContent) {
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
  }

  // @MongoDB what is mongodb?
  async handleGenericRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ChatResult> {
    const messages = GenericPrompt.buildMessages({
      request,
      context,
    });

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });
    const responseContent = await this.getChatResponseContent({
      messages,
      token,
    });
    stream.markdown(responseContent);

    this._streamRunnableContentActions({
      responseContent,
      stream,
    });

    return genericRequestChatResult(context.history);
  }

  async connectWithParticipant(id?: string): Promise<boolean> {
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
      `/query ${connectionName}`
    ) as Promise<boolean>;
  }

  getConnectionsTree(): vscode.MarkdownString[] {
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
            data: conn.id,
            name: conn.name,
          })
        ),
      createMarkdownLink({
        commandId: EXTENSION_COMMANDS.CONNECT_WITH_PARTICIPANT,
        name: 'Show more',
      }),
    ];
  }

  async getDatabaseQuickPicks(): Promise<NamespaceQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      // Run a blank command to get the user to connect first.
      void this.writeChatMessageAsUser('/query');
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

  async _selectDatabaseWithQuickPick(): Promise<string | undefined> {
    const databases = await this.getDatabaseQuickPicks();
    const selectedQuickPickItem = await vscode.window.showQuickPick(databases, {
      placeHolder: 'Select a database...',
    });
    return selectedQuickPickItem?.data;
  }

  async selectDatabaseWithParticipant({
    chatId,
    databaseName: _databaseName,
  }: {
    chatId: string;
    databaseName?: string;
  }): Promise<boolean> {
    let databaseName: string | undefined = _databaseName;
    if (!databaseName) {
      databaseName = await this._selectDatabaseWithQuickPick();
      if (!databaseName) {
        return false;
      }
    }

    this._chatMetadataStore.setChatMetadata(chatId, {
      databaseName: databaseName,
    });

    return this.writeChatMessageAsUser(
      `/query ${databaseName}`
    ) as Promise<boolean>;
  }

  async getCollectionQuickPicks(
    databaseName: string
  ): Promise<NamespaceQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      // Run a blank command to get the user to connect first.
      void this.writeChatMessageAsUser('/query');
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

  async _selectCollectionWithQuickPick(
    databaseName: string
  ): Promise<string | undefined> {
    const collections = await this.getCollectionQuickPicks(databaseName);
    const selectedQuickPickItem = await vscode.window.showQuickPick(
      collections,
      {
        placeHolder: 'Select a collection...',
      }
    );
    return selectedQuickPickItem?.data;
  }

  async selectCollectionWithParticipant({
    chatId,
    databaseName,
    collectionName: _collectionName,
  }: {
    chatId: string;
    databaseName: string;
    collectionName?: string;
  }): Promise<boolean> {
    let collectionName: string | undefined = _collectionName;
    if (!collectionName) {
      collectionName = await this._selectCollectionWithQuickPick(databaseName);
      if (!collectionName) {
        return false;
      }
    }

    this._chatMetadataStore.setChatMetadata(chatId, {
      databaseName: databaseName,
      collectionName: collectionName,
    });
    return this.writeChatMessageAsUser(
      `/query ${collectionName}`
    ) as Promise<boolean>;
  }

  async getDatabasesTree(
    context: vscode.ChatContext
  ): Promise<vscode.MarkdownString[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return [];
    }

    try {
      const databases = await dataService.listDatabases({
        nameOnly: true,
      });
      return [
        ...databases.slice(0, MAX_MARKDOWN_LIST_LENGTH).map((db) =>
          createMarkdownLink({
            commandId: EXTENSION_COMMANDS.SELECT_DATABASE_WITH_PARTICIPANT,
            data: {
              chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
                context.history
              ),
              databaseName: db.name,
            },
            name: db.name,
          })
        ),
        ...(databases.length > MAX_MARKDOWN_LIST_LENGTH
          ? [
              createMarkdownLink({
                data: {
                  chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
                    context.history
                  ),
                },
                commandId: EXTENSION_COMMANDS.SELECT_DATABASE_WITH_PARTICIPANT,
                name: 'Show more',
              }),
            ]
          : []),
      ];
    } catch (error) {
      // Users can always do this manually when asked to provide a database name.
      return [];
    }
  }

  async getCollectionTree(
    databaseName: string,
    context: vscode.ChatContext
  ): Promise<vscode.MarkdownString[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return [];
    }

    try {
      const collections = await dataService.listCollections(databaseName);
      return [
        ...collections.slice(0, MAX_MARKDOWN_LIST_LENGTH).map((coll) =>
          createMarkdownLink({
            commandId: EXTENSION_COMMANDS.SELECT_COLLECTION_WITH_PARTICIPANT,
            data: {
              chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
                context.history
              ),
              databaseName,
              collectionName: coll.name,
            },
            name: coll.name,
          })
        ),
        ...(collections.length > MAX_MARKDOWN_LIST_LENGTH
          ? [
              createMarkdownLink({
                commandId:
                  EXTENSION_COMMANDS.SELECT_COLLECTION_WITH_PARTICIPANT,
                data: {
                  chatId: ChatMetadataStore.getChatIdFromHistoryOrNewChatId(
                    context.history
                  ),
                },
                name: 'Show more',
              }),
            ]
          : []),
      ];
    } catch (error) {
      // Users can always do this manually when asked to provide a collection name.
      return [];
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
    const messagesWithNamespace = NamespacePrompt.buildMessages({
      context,
      request,
      connectionNames: this._connectionController
        .getSavedConnections()
        .map((connection) => connection.name),
    });
    const responseContentWithNamespace = await this.getChatResponseContent({
      messages: messagesWithNamespace,
      token,
    });
    const namespace = parseForDatabaseAndCollectionName(
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
      databaseName: namespace.databaseName ?? databaseNameFromMetadata,
      collectionName: namespace.collectionName ?? collectionNameFromMetadata,
    };
  }

  async _askForNamespace({
    context,
    databaseName,
    collectionName,
    stream,
  }: {
    context: vscode.ChatContext;
    databaseName: string | undefined;
    collectionName: string | undefined;
    stream: vscode.ChatResponseStream;
  }): Promise<ChatResult> {
    // If no database or collection name is found in the user prompt,
    // we retrieve the available namespaces from the current connection.
    // Users can then select a value by clicking on an item in the list.
    if (!databaseName) {
      const tree = await this.getDatabasesTree(context);
      stream.markdown(
        'What is the name of the database you would like this query to run against?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
    } else if (!collectionName) {
      const tree = await this.getCollectionTree(databaseName, context);
      stream.markdown(
        `Which collection would you like to query within ${databaseName}?\n\n`
      );
      for (const item of tree) {
        stream.markdown(item);
      }
    }

    return namespaceRequestChatResult({
      databaseName,
      collectionName,
      history: context.history,
    });
  }

  _askToConnect(
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream
  ): ChatResult {
    const tree = this.getConnectionsTree();
    stream.markdown(
      "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n"
    );

    for (const item of tree) {
      stream.markdown(item);
    }
    return askToConnectChatResult(context.history);
  }

  // The sample documents returned from this are simplified (strings and arrays shortened).
  async _fetchCollectionSchemaAndSampleDocuments({
    abortSignal,
    databaseName,
    collectionName,
  }: {
    abortSignal;
    databaseName: string;
    collectionName: string;
  }): Promise<{
    schema?: string;
    sampleDocuments?: Document[];
  }> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      return {};
    }

    try {
      const sampleDocuments =
        (await dataService?.sample?.(
          `${databaseName}.${collectionName}`,
          {
            query: {},
            size: NUM_DOCUMENTS_TO_SAMPLE,
          },
          { promoteValues: false },
          {
            abortSignal,
          }
        )) || [];

      const unformattedSchema = await getSimplifiedSchema(sampleDocuments);
      const schema = new SchemaFormatter().format(unformattedSchema);

      const useSampleDocsInCopilot = !!vscode.workspace
        .getConfiguration('mdb')
        .get('useSampleDocsInCopilot');

      return {
        sampleDocuments: useSampleDocsInCopilot
          ? getSimplifiedSampleDocuments(sampleDocuments)
          : undefined,
        schema,
      };
    } catch (err: any) {
      log.error('Unable to fetch schema and sample documents', err);
      return {};
    }
  }

  async handleEmptyQueryRequest({
    context,
    stream,
  }: {
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
  }): Promise<ChatResult> {
    const lastMessageMetaData: vscode.ChatResponseTurn | undefined = context
      .history[context.history.length - 1] as vscode.ChatResponseTurn;
    const lastMessage = lastMessageMetaData?.result as ChatResult;
    if (lastMessage?.metadata?.intent !== 'askForNamespace') {
      stream.markdown(GenericPrompt.getEmptyRequestResponse());
      return emptyRequestChatResult(context.history);
    }

    // When the last message was asking for a database or collection name,
    // we re-ask the question.
    let tree: vscode.MarkdownString[];
    const databaseName = lastMessage.metadata.databaseName;
    if (databaseName) {
      stream.markdown(
        vscode.l10n.t(
          'Please select a collection by either clicking on an item in the list or typing the name manually in the chat.'
        )
      );
      tree = await this.getCollectionTree(databaseName, context);
    } else {
      stream.markdown(
        vscode.l10n.t(
          'Please select a database by either clicking on an item in the list or typing the name manually in the chat.'
        )
      );
      tree = await this.getDatabasesTree(context);
    }

    for (const item of tree) {
      stream.markdown(item);
    }

    return namespaceRequestChatResult({
      databaseName,
      collectionName: undefined,
      history: context.history,
    });
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  async handleQueryRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ChatResult> {
    if (!this._connectionController.getActiveDataService()) {
      return this._askToConnect(context, stream);
    }

    if (!request.prompt || request.prompt.trim().length === 0) {
      return this.handleEmptyQueryRequest({
        context,
        stream,
      });
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
        context,
        databaseName,
        collectionName,
        stream,
      });
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    const { schema, sampleDocuments } =
      await this._fetchCollectionSchemaAndSampleDocuments({
        abortSignal: abortController.signal,
        databaseName,
        collectionName,
      });

    const messages = await QueryPrompt.buildMessages({
      request,
      context,
      databaseName,
      collectionName,
      schema,
      connectionNames: this._connectionController
        .getSavedConnections()
        .map((connection) => connection.name),
      ...(sampleDocuments ? { sampleDocuments } : {}),
    });
    const responseContent = await this.getChatResponseContent({
      messages,
      token,
    });

    stream.markdown(responseContent);

    this._streamRunnableContentActions({
      responseContent,
      stream,
    });

    return queryRequestChatResult(context.history);
  }

  async _handleDocsRequestWithChatbot({
    prompt,
    chatId,
  }: {
    prompt: string;
    chatId: string;
  }): Promise<{
    responseContent: string;
    responseReferences?: Reference[];
    docsChatbotMessageId: string;
  }> {
    let { docsChatbotConversationId } =
      this._chatMetadataStore.getChatMetadata(chatId) ?? {};
    if (!docsChatbotConversationId) {
      const conversation =
        await this._docsChatbotAIService.createConversation();
      docsChatbotConversationId = conversation._id;
      this._chatMetadataStore.setChatMetadata(chatId, {
        docsChatbotConversationId,
      });
      log.info('Docs chatbot created for chatId', chatId);
    }

    const response = await this._docsChatbotAIService.addMessage({
      message: prompt,
      conversationId: docsChatbotConversationId,
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
  ): Promise<{
    responseContent: string;
    responseReferences?: Reference[];
  }> {
    const [request, context, , token] = args;
    const messages = GenericPrompt.buildMessages({
      request,
      context,
    });

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });
    const responseContent = await this.getChatResponseContent({
      messages,
      token,
    });
    const responseReferences = [
      {
        url: MONGODB_DOCS_LINK,
        title: 'View MongoDB documentation',
      },
    ];

    return {
      responseContent,
      responseReferences,
    };
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
    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

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
      });
    } catch (error) {
      // If the docs chatbot API is not available, fall back to Copilot’s LLM and include
      // the MongoDB documentation link for users to go to our documentation site directly.
      log.error(error);
      docsResult = await this._handleDocsRequestWithCopilot(...args);
    }

    if (docsResult.responseContent) {
      stream.markdown(docsResult.responseContent);
      this._streamRunnableContentActions({
        responseContent: docsResult.responseContent,
        stream,
      });
    }

    if (docsResult.responseReferences) {
      for (const ref of docsResult.responseReferences) {
        const link = new vscode.MarkdownString(
          `- <a href="${ref.url}">${ref.title}</a>\n`
        );
        link.supportHtml = true;
        stream.markdown(link);
      }
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
          // TODO(VSCODE-571): Implement this.
          return await this.handleGenericRequest(...args);
        default:
          if (!request.prompt?.trim()) {
            stream.markdown(GenericPrompt.getEmptyRequestResponse());
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
}
