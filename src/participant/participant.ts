import * as vscode from 'vscode';
import { getSimplifiedSchema } from 'mongodb-schema';
import type { Document } from 'bson';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

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
import { chatResultFeedbackKindToTelemetryValue } from '../telemetry/telemetryService';
import type TelemetryService from '../telemetry/telemetryService';

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
  _context: vscode.ExtensionContext;
  _connectionController: ConnectionController;
  _storageController: StorageController;
  _chatMetadataStore: ChatMetadataStore;
  _docsChatbotAIService: DocsChatbotAIService;
  _telemetryService: TelemetryService;

  constructor({
    context,
    connectionController,
    storageController,
    telemetryService,
  }: {
    context: vscode.ExtensionContext;
    connectionController: ConnectionController;
    storageController: StorageController;
    telemetryService: TelemetryService;
  }) {
    this._context = context;
    this._connectionController = connectionController;
    this._storageController = storageController;
    this._chatMetadataStore = new ChatMetadataStore();
    this._telemetryService = telemetryService;

    const docsChatbotBaseUri = this._readDocsChatbotBaseUri();
    this._docsChatbotAIService = new DocsChatbotAIService(docsChatbotBaseUri);
  }

  // To integrate with the MongoDB documentation chatbot,
  // set the MONGODB_DOCS_CHATBOT_BASE_URI environment variable when running the extension from a branch.
  // This variable is automatically injected during the .vsix build process via GitHub Actions.
  private _readDocsChatbotBaseUri(): string | undefined {
    config({ path: path.join(this._context.extensionPath, '.env') });

    try {
      const docsChatbotBaseUriFileLocation = path.join(
        this._context.extensionPath,
        './constants.json'
      );
      // eslint-disable-next-line no-sync
      const constantsFile = fs.readFileSync(
        docsChatbotBaseUriFileLocation,
        'utf8'
      );
      const { docsChatbotBaseUri } = JSON.parse(constantsFile) as {
        docsChatbotBaseUri?: string;
      };
      return docsChatbotBaseUri;
    } catch (error) {
      log.error(
        'Failed to read docsChatbotBaseUri from the constants file',
        error
      );
      return;
    }
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
    log.info('Chat Participant Created', {
      participantId: this._participant?.id,
    });
    this._participant.onDidReceiveFeedback(this.handleUserFeedback.bind(this));
    return this._participant;
  }

  getParticipant(): vscode.ChatParticipant | undefined {
    return this._participant;
  }

  handleError(err: any, stream: vscode.ChatResponseStream): void {
    // Making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quote limits exceeded
    if (err instanceof vscode.LanguageModelError) {
      log.error(err.message, err.code, err.cause);
      if (
        err.cause instanceof Error &&
        err.cause.message.includes('off_topic')
      ) {
        stream.markdown(
          vscode.l10n.t(
            "I'm sorry, I can only explain computer science concepts.\n\n"
          )
        );
      }
    } else {
      // Re-throw other errors so they show up in the UI.
      throw err;
    }
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
    stream,
    token,
  }: {
    messages: vscode.LanguageModelChatMessage[];
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }): Promise<string> {
    const model = await getCopilotModel();
    let responseContent = '';
    if (model) {
      try {
        const chatResponse = await model.sendRequest(messages, {}, token);
        for await (const fragment of chatResponse.text) {
          responseContent += fragment;
        }
      } catch (err) {
        this.handleError(err, stream);
      }
    }

    return responseContent;
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
      stream,
      token,
    });
    stream.markdown(responseContent);

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
    stream,
    token,
  }: {
    request: vscode.ChatRequest;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
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
      stream,
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
      stream,
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
      stream,
      token,
    });

    stream.markdown(responseContent);

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

    return queryRequestChatResult(context.history);
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

    let responseContent;
    let responseReferences;
    try {
      let { docsChatbotConversationId } =
        this._chatMetadataStore.getChatMetadata(chatId) ?? {};
      if (!docsChatbotConversationId) {
        const conversation =
          await this._docsChatbotAIService.createConversation();
        docsChatbotConversationId = conversation._id;
        this._chatMetadataStore.setChatMetadata(chatId, {
          docsChatbotConversationId,
        });
      }

      const response = await this._docsChatbotAIService.addMessage({
        message: request.prompt,
        conversationId: docsChatbotConversationId,
      });

      responseContent = response.content;
      responseReferences = response.references;
    } catch (error) {
      log.error(error);

      // If the docs chatbot API is not available, fall back to Copilot’s LLM and include
      // the MongoDB documentation link for users to go to our documentation site directly.
      const messages = GenericPrompt.buildMessages({
        request,
        context,
      });

      const abortController = new AbortController();
      token.onCancellationRequested(() => {
        abortController.abort();
      });
      responseContent = await this.getChatResponseContent({
        messages,
        stream,
        token,
      });
      responseReferences = [
        {
          url: MONGODB_DOCS_LINK,
          title: 'View MongoDB documentation',
        },
      ];
    }

    stream.markdown(responseContent);

    const runnableContent = getRunnableContentFromString(responseContent);
    if (runnableContent && runnableContent.trim().length) {
      stream.button({
        command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
        title: vscode.l10n.t('▶️ Run'),
      });

      stream.button({
        command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
        title: vscode.l10n.t('Open in playground'),
      });
    }

    if (responseReferences) {
      for (const ref of responseReferences) {
        const link = new vscode.MarkdownString(
          `- <a href="${ref.url}">${ref.title}</a>\n`
        );
        link.supportHtml = true;
        stream.markdown(link);
      }
    }

    return docsRequestChatResult(chatId);
  }

  async chatHandler(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken
    ]
  ): Promise<ChatResult | undefined> {
    const [request, , stream] = args;

    if (
      !request.command &&
      (!request.prompt || request.prompt.trim().length === 0)
    ) {
      stream.markdown(GenericPrompt.getEmptyRequestResponse());
      return emptyRequestChatResult(args[1].history);
    }

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
      void this._storageController.update(
        StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE,
        true
      );
    }

    if (request.command === 'query') {
      return await this.handleQueryRequest(...args);
    } else if (request.command === 'docs') {
      return await this.handleDocsRequest(...args);
    } else if (request.command === 'schema') {
      // TODO(VSCODE-571): Implement this.
    }
    return await this.handleGenericRequest(...args);
  }

  handleUserFeedback(feedback: vscode.ChatResultFeedback): void {
    this._telemetryService.trackCopilotParticipantFeedback({
      feedback: chatResultFeedbackKindToTelemetryValue(feedback.kind),
      reason: feedback.unhelpfulReason,
      response_type: (feedback.result as ChatResult)?.metadata.intent,
    });
  }
}
