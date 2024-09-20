import * as vscode from 'vscode';
import { getSimplifiedSchema, parseSchema } from 'mongodb-schema';
import type { Document } from 'bson';
import { config } from 'dotenv';
import path from 'path';
import { promises as fs } from 'fs';
import type { Reference } from 'mongodb-rag-core';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import type { LoadedConnection } from '../storage/connectionStorage';
import EXTENSION_COMMANDS from '../commands';
import type { StorageController } from '../storage';
import { StorageVariables } from '../storage';
import { GenericPrompt, isPromptEmpty } from './prompts/generic';
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
} from './constants';
import { QueryPrompt } from './prompts/query';
import { COL_NAME_ID, DB_NAME_ID, NamespacePrompt } from './prompts/namespace';
import { SchemaFormatter } from './schema';
import { getSimplifiedSampleDocuments } from './sampleDocuments';
import { getCopilotModel } from './model';
import { createMarkdownLink } from './markdown';
import { ChatMetadataStore } from './chatMetadata';
import { doesLastMessageAskForNamespace } from './prompts/history';
import {
  DOCUMENTS_TO_SAMPLE_FOR_SCHEMA_PROMPT,
  type OpenSchemaCommandArgs,
  SchemaPrompt,
} from './prompts/schema';
import {
  chatResultFeedbackKindToTelemetryValue,
  TelemetryEventTypes,
} from '../telemetry/telemetryService';
import { DocsChatbotAIService } from './docsChatbotAIService';
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

type ParticipantCommand = '/query' | '/schema';

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
  _docsChatbotAIService?: DocsChatbotAIService;
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
  }

  // To integrate with the MongoDB documentation chatbot,
  // set the MONGODB_DOCS_CHATBOT_BASE_URI environment variable when running the extension from a branch.
  // This variable is automatically injected during the .vsix build process via GitHub Actions.
  async _readDocsChatbotBaseUri(
    context: vscode.ExtensionContext
  ): Promise<string | undefined> {
    config({ path: path.join(context.extensionPath, '.env') });

    try {
      const docsChatbotBaseUriFileLocation = path.join(
        context.extensionPath,
        './constants.json'
      );
      // eslint-disable-next-line no-sync
      const constantsFile = await fs.readFile(
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

  async createDocsChatbot(context: vscode.ExtensionContext): Promise<void> {
    const docsChatbotBaseUri = await this._readDocsChatbotBaseUri(context);
    this._docsChatbotAIService = new DocsChatbotAIService(docsChatbotBaseUri);
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
      stream,
      token,
    });
    stream.markdown(responseContent);

    this._streamRunnableContentActions({
      responseContent,
      stream,
    });

    return genericRequestChatResult(context.history);
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

  async getDatabasesTree({
    command,
    context,
  }: {
    command: ParticipantCommand;
    context: vscode.ChatContext;
  }): Promise<vscode.MarkdownString[]> {
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
              command,
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
                  command,
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

  async getCollectionTree({
    command,
    context,
    databaseName,
  }: {
    command: ParticipantCommand;
    databaseName: string;
    context: vscode.ChatContext;
  }): Promise<vscode.MarkdownString[]> {
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
              command,
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
                  command,
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
      const tree = await this.getDatabasesTree({
        command,
        context,
      });
      stream.markdown(
        `What is the name of the database you would like ${
          command === '/query' ? 'this query' : ''
        } to run against?\n\n`
      );
      for (const item of tree) {
        stream.markdown(item);
      }
    } else if (!collectionName) {
      const tree = await this.getCollectionTree({
        command,
        databaseName,
        context,
      });
      stream.markdown(
        `Which collection would you like to use within ${databaseName}?\n\n`
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

  // The sample documents returned from this are simplified (strings and arrays shortened).
  // The sample documents are only returned when a user has the setting enabled.
  async _fetchCollectionSchemaAndSampleDocuments({
    abortSignal,
    databaseName,
    collectionName,
    amountOfDocumentsToSample = NUM_DOCUMENTS_TO_SAMPLE,
    schemaFormat = 'simplified',
  }: {
    abortSignal;
    databaseName: string;
    collectionName: string;
    amountOfDocumentsToSample?: number;
    schemaFormat?: 'simplified' | 'full';
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

    try {
      const sampleDocuments = await dataService.sample(
        `${databaseName}.${collectionName}`,
        {
          query: {},
          size: amountOfDocumentsToSample,
        },
        { promoteValues: false },
        {
          abortSignal,
        }
      );

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
      log.error('Unable to fetch schema and sample documents', err);
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
      tree = await this.getCollectionTree({
        command,
        databaseName,
        context,
      });
    } else {
      stream.markdown(
        vscode.l10n.t(
          'Please select a database by either clicking on an item in the list or typing the name manually in the chat.'
        )
      );
      tree = await this.getDatabasesTree({
        command,
        context,
      });
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
      isPromptEmpty(request) &&
      doesLastMessageAskForNamespace(context.history)
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
      stream,
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

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    stream.push(
      new vscode.ChatResponseProgressPart(
        'Fetching documents and analyzing schema...'
      )
    );

    let sampleDocuments: Document[] | undefined;
    let amountOfDocumentsSampled: number;
    let schema: string | undefined;
    try {
      ({
        sampleDocuments,
        amountOfDocumentsSampled, // There can be fewer than the amount we attempt to sample.
        schema,
      } = await this._fetchCollectionSchemaAndSampleDocuments({
        abortSignal: abortController.signal,
        databaseName,
        schemaFormat: 'full',
        collectionName,
        amountOfDocumentsToSample: DOCUMENTS_TO_SAMPLE_FOR_SCHEMA_PROMPT,
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

    const messages = SchemaPrompt.buildMessages({
      request,
      context,
      databaseName,
      amountOfDocumentsSampled,
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

    if (isPromptEmpty(request)) {
      if (doesLastMessageAskForNamespace(context.history)) {
        return this.handleEmptyNamespaceMessage({
          command: '/query',
          context,
          stream,
        });
      }

      stream.markdown(QueryPrompt.getEmptyRequestResponse());
      return emptyRequestChatResult(context.history);
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
        command: '/query',
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

    let schema: string | undefined;
    let sampleDocuments: Document[] | undefined;
    try {
      ({ schema, sampleDocuments } =
        await this._fetchCollectionSchemaAndSampleDocuments({
          abortSignal: abortController.signal,
          databaseName,
          collectionName,
        }));
    } catch (e) {
      // When an error fetching the collection schema or sample docs occurs,
      // we still want to continue as it isn't critical, however,
      // we do want to notify the user.
      stream.markdown(
        vscode.l10n.t(
          'An error occurred while fetching the collection schema and sample documents.\nThe generated query will not be able to reference your data.'
        )
      );
    }

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

    this._streamRunnableContentActions({
      responseContent,
      stream,
    });

    return queryRequestChatResult(context.history);
  }

  async _handleDocsRequestWithChatbot({
    docsChatbotAIService,
    prompt,
    chatId,
  }: {
    docsChatbotAIService: DocsChatbotAIService;
    prompt: string;
    chatId: string;
  }): Promise<{
    responseContent: string;
    responseReferences?: Reference[];
  }> {
    let { docsChatbotConversationId } =
      this._chatMetadataStore.getChatMetadata(chatId) ?? {};
    if (!docsChatbotConversationId) {
      const conversation = await docsChatbotAIService.createConversation();
      docsChatbotConversationId = conversation._id;
      this._chatMetadataStore.setChatMetadata(chatId, {
        docsChatbotConversationId,
      });
    }

    const response = await docsChatbotAIService.addMessage({
      message: prompt,
      conversationId: docsChatbotConversationId,
    });

    return {
      responseContent: response.content,
      responseReferences: response.references,
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
    const [request, context, stream, token] = args;
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

    let docsChatbotHasThrownError = false;
    let docsResult: {
      responseContent?: string;
      responseReferences?: Reference[];
    } = {};

    if (this._docsChatbotAIService) {
      try {
        docsResult = await this._handleDocsRequestWithChatbot({
          docsChatbotAIService: this._docsChatbotAIService,
          prompt: request.prompt,
          chatId,
        });
      } catch (error) {
        // If the docs chatbot API is not available, fall back to Copilot’s LLM and include
        // the MongoDB documentation link for users to go to our documentation site directly.
        docsChatbotHasThrownError = true;
        log.error(error);
      }
    }

    if (!this._docsChatbotAIService || docsChatbotHasThrownError) {
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

      this._telemetryService.track(
        TelemetryEventTypes.PARTICIPANT_WELCOME_SHOWN
      );

      await this._storageController.update(
        StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE,
        true
      );
    }

    if (request.command === 'query') {
      return await this.handleQueryRequest(...args);
    } else if (request.command === 'docs') {
      return await this.handleDocsRequest(...args);
    } else if (request.command === 'schema') {
      return await this.handleSchemaRequest(...args);
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
