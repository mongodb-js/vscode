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
import { CHAT_PARTICIPANT_ID } from './constants';
import { QueryPrompt } from './prompts/query';
import { COL_NAME_ID, DB_NAME_ID, NamespacePrompt } from './prompts/namespace';
import { SchemaFormatter } from './schema';
import { getSimplifiedSampleDocuments } from './sampleDocuments';
import { getCopilotModel } from './model';
import { chatResultFeedbackKindToTelemetryValue } from '../telemetry/telemetryService';
import type { ParticipantResponseType } from '../telemetry/telemetryService';
import type TelemetryService from '../telemetry/telemetryService';

const log = createLogger('participant');

export enum QUERY_GENERATION_STATE {
  DEFAULT = 'DEFAULT',
  ASK_TO_CONNECT = 'ASK_TO_CONNECT',
  ASK_FOR_DATABASE_NAME = 'ASK_FOR_DATABASE_NAME',
  ASK_FOR_COLLECTION_NAME = 'ASK_FOR_COLLECTION_NAME',
  CHANGE_DATABASE_NAME = 'CHANGE_DATABASE_NAME',
  FETCH_SCHEMA = 'FETCH_SCHEMA',
}

const NUM_DOCUMENTS_TO_SAMPLE = 3;

interface ChatResult extends vscode.ChatResult {
  metadata: {
    responseContent?: string;
    responseType: ParticipantResponseType;
  };
}

interface NamespaceQuickPicks {
  label: string;
  data: string;
}

const DB_NAME_REGEX = `${DB_NAME_ID}: (.*)\n?`;
const COL_NAME_REGEX = `${COL_NAME_ID}: (.*)\n?`;

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
  _telemetryService: TelemetryService;
  _queryGenerationState?: QUERY_GENERATION_STATE;
  _chatResult?: ChatResult;
  _databaseName?: string;
  _collectionName?: string;
  _schema?: string;
  _sampleDocuments?: Document[];

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
    this._telemetryService = telemetryService;
  }

  _setDatabaseName(name: string | undefined): void {
    if (
      this._queryGenerationState === QUERY_GENERATION_STATE.DEFAULT &&
      this._databaseName !== name
    ) {
      this._queryGenerationState = QUERY_GENERATION_STATE.CHANGE_DATABASE_NAME;
      this._collectionName = undefined;
    }
    this._databaseName = name;
  }

  _setCollectionName(name: string | undefined): void {
    if (
      this._queryGenerationState === QUERY_GENERATION_STATE.DEFAULT &&
      this._collectionName !== name
    ) {
      this._queryGenerationState = QUERY_GENERATION_STATE.FETCH_SCHEMA;
    }
    this._collectionName = name;
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

  async handleEmptyQueryRequest(): Promise<(string | vscode.MarkdownString)[]> {
    const messages: (string | vscode.MarkdownString)[] = [];
    switch (this._queryGenerationState) {
      case QUERY_GENERATION_STATE.ASK_TO_CONNECT:
        messages.push(
          vscode.l10n.t(
            'Please select a cluster to connect by clicking on an item in the connections list.'
          )
        );
        messages.push(...this.getConnectionsTree());
        break;
      case QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME:
        messages.push(
          vscode.l10n.t(
            'Please select a database by either clicking on an item in the list or typing the name manually in the chat.'
          )
        );
        messages.push(...(await this.getDatabasesTree()));
        break;
      case QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME:
        messages.push(
          vscode.l10n.t(
            'Please select a collection by either clicking on an item in the list or typing the name manually in the chat.'
          )
        );
        messages.push(...(await this.getCollectionTree()));
        break;
      default:
        messages.push(
          vscode.l10n.t(
            'Please specify a question when using this command. Usage: @MongoDB /query find documents where "name" contains "database".'
          )
        );
    }
    return messages;
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

    return {
      metadata: { responseContent: runnableContent, responseType: 'generic' },
    };
  }

  async connectWithParticipant(id?: string): Promise<boolean> {
    if (!id) {
      await this._connectionController.changeActiveConnection();
    } else {
      await this._connectionController.connectWithConnectionId(id);
    }

    const connectionName = this._connectionController.getActiveConnectionName();
    if (connectionName) {
      this._queryGenerationState = QUERY_GENERATION_STATE.DEFAULT;
    }

    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /query ${connectionName}`,
    });
  }

  _createMarkdownLink({
    commandId,
    query,
    name,
  }: {
    commandId: string;
    query?: string;
    name: string;
  }): vscode.MarkdownString {
    const commandQuery = query ? `?%5B%22${query}%22%5D` : '';
    const connName = new vscode.MarkdownString(
      `- <a href="command:${commandId}${commandQuery}">${name}</a>\n`
    );
    connName.supportHtml = true;
    connName.isTrusted = { enabledCommands: [commandId] };
    return connName;
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
          this._createMarkdownLink({
            commandId: 'mdb.connectWithParticipant',
            query: conn.id,
            name: conn.name,
          })
        ),
      this._createMarkdownLink({
        commandId: 'mdb.connectWithParticipant',
        name: 'Show more',
      }),
    ];
  }

  async getDatabaseQuickPicks(): Promise<NamespaceQuickPicks[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      this._queryGenerationState = QUERY_GENERATION_STATE.ASK_TO_CONNECT;
      return [];
    }

    try {
      const databases = await dataService.listDatabases();
      return databases.map((db) => ({
        label: db.name,
        data: db.name,
      }));
    } catch (error) {
      return [];
    }
  }

  async _selectDatabaseWithCommandPalette(): Promise<string | undefined> {
    const databases = await this.getDatabaseQuickPicks();
    const selectedQuickPickItem = await vscode.window.showQuickPick(databases, {
      placeHolder: 'Select a database...',
    });
    return selectedQuickPickItem?.data;
  }

  async selectDatabaseWithParticipant(name: string): Promise<boolean> {
    if (!name) {
      const selectedName = await this._selectDatabaseWithCommandPalette();
      this._setDatabaseName(selectedName);
    } else {
      this._setDatabaseName(name);
    }

    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /query ${this._databaseName || ''}`,
    });
  }

  async getCollectionQuickPicks(): Promise<NamespaceQuickPicks[]> {
    if (!this._databaseName) {
      return [];
    }

    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      this._queryGenerationState = QUERY_GENERATION_STATE.ASK_TO_CONNECT;
      return [];
    }

    try {
      const collections = await dataService.listCollections(this._databaseName);
      return collections.map((db) => ({
        label: db.name,
        data: db.name,
      }));
    } catch (error) {
      return [];
    }
  }

  async _selectCollectionWithCommandPalette(): Promise<string | undefined> {
    const collections = await this.getCollectionQuickPicks();
    const selectedQuickPickItem = await vscode.window.showQuickPick(
      collections,
      {
        placeHolder: 'Select a collection...',
      }
    );
    return selectedQuickPickItem?.data;
  }

  async selectCollectionWithParticipant(name: string): Promise<boolean> {
    if (!name) {
      const selectedName = await this._selectCollectionWithCommandPalette();
      this._setCollectionName(selectedName);
    } else {
      this._setCollectionName(name);
    }

    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /query ${this._collectionName || ''}`,
    });
  }

  async getDatabasesTree(): Promise<vscode.MarkdownString[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      this._queryGenerationState = QUERY_GENERATION_STATE.ASK_TO_CONNECT;
      return [];
    }

    try {
      const databases = await dataService.listDatabases();
      return [
        ...databases.slice(0, MAX_MARKDOWN_LIST_LENGTH).map((db) =>
          this._createMarkdownLink({
            commandId: 'mdb.selectDatabaseWithParticipant',
            query: db.name,
            name: db.name,
          })
        ),
        ...(databases.length > MAX_MARKDOWN_LIST_LENGTH
          ? [
              this._createMarkdownLink({
                commandId: 'mdb.selectDatabaseWithParticipant',
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

  async getCollectionTree(): Promise<vscode.MarkdownString[]> {
    if (!this._databaseName) {
      return [];
    }

    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      this._queryGenerationState = QUERY_GENERATION_STATE.ASK_TO_CONNECT;
      return [];
    }

    try {
      const collections = await dataService.listCollections(this._databaseName);
      return [
        ...collections.slice(0, MAX_MARKDOWN_LIST_LENGTH).map((coll) =>
          this._createMarkdownLink({
            commandId: 'mdb.selectCollectionWithParticipant',
            query: coll.name,
            name: coll.name,
          })
        ),
        ...(collections.length > MAX_MARKDOWN_LIST_LENGTH
          ? [
              this._createMarkdownLink({
                commandId: 'mdb.selectCollectionWithParticipant',
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

  _ifNewChatResetQueryGenerationState(context: vscode.ChatContext): void {
    const isNewChat = !context.history.find(
      (historyItem) => historyItem.participant === CHAT_PARTICIPANT_ID
    );
    if (isNewChat) {
      this._queryGenerationState = QUERY_GENERATION_STATE.DEFAULT;
      this._chatResult = undefined;
      this._setDatabaseName(undefined);
      this._setCollectionName(undefined);
    }
  }

  _waitingForUserToProvideNamespace(prompt: string): boolean {
    if (
      !this._queryGenerationState ||
      ![
        QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME,
        QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME,
        QUERY_GENERATION_STATE.CHANGE_DATABASE_NAME,
      ].includes(this._queryGenerationState)
    ) {
      return false;
    }

    if (
      [
        QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME,
        QUERY_GENERATION_STATE.CHANGE_DATABASE_NAME,
      ].includes(this._queryGenerationState)
    ) {
      this._setDatabaseName(prompt);
      if (!this._collectionName) {
        this._queryGenerationState =
          QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME;
        return true;
      }
      return false;
    }

    if (
      this._queryGenerationState ===
      QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME
    ) {
      this._setCollectionName(prompt);
      if (!this._databaseName) {
        this._queryGenerationState =
          QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME;
        return true;
      }
      this._queryGenerationState = QUERY_GENERATION_STATE.FETCH_SCHEMA;
      return false;
    }

    return false;
  }

  async _shouldAskForNamespace(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<boolean> {
    if (this._waitingForUserToProvideNamespace(request.prompt)) {
      return true;
    }

    if (this._databaseName && this._collectionName) {
      return false;
    }

    const messagesWithNamespace = NamespacePrompt.buildMessages({
      context,
      request,
    });
    const responseContentWithNamespace = await this.getChatResponseContent({
      messages: messagesWithNamespace,
      stream,
      token,
    });
    const namespace = parseForDatabaseAndCollectionName(
      responseContentWithNamespace
    );

    this._setDatabaseName(namespace.databaseName || this._databaseName);
    this._setCollectionName(namespace.collectionName || this._collectionName);

    if (namespace.databaseName && namespace.collectionName) {
      this._queryGenerationState = QUERY_GENERATION_STATE.FETCH_SCHEMA;
      return false;
    }

    return true;
  }

  async _askForNamespace(stream: vscode.ChatResponseStream): Promise<void> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      this._queryGenerationState = QUERY_GENERATION_STATE.ASK_TO_CONNECT;
      return;
    }

    // If no database or collection name is found in the user prompt,
    // we retrieve the available namespaces from the current connection.
    // Users can then select a value by clicking on an item in the list.
    if (!this._databaseName) {
      const tree = await this.getDatabasesTree();
      stream.markdown(
        'What is the name of the database you would like this query to run against?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
      this._queryGenerationState = QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME;
    } else if (!this._collectionName) {
      const tree = await this.getCollectionTree();
      stream.markdown(
        'Which collection would you like to query within this database?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
      this._queryGenerationState =
        QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME;
    }
  }

  _shouldAskToConnectIfNotConnected(
    stream: vscode.ChatResponseStream
  ): boolean {
    const dataService = this._connectionController.getActiveDataService();
    if (dataService) {
      return false;
    }

    const tree = this.getConnectionsTree();
    stream.markdown(
      "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n"
    );
    for (const item of tree) {
      stream.markdown(item);
    }
    this._queryGenerationState = QUERY_GENERATION_STATE.ASK_TO_CONNECT;
    return true;
  }

  _shouldFetchCollectionSchema(): boolean {
    return this._queryGenerationState === QUERY_GENERATION_STATE.FETCH_SCHEMA;
  }

  async _fetchCollectionSchemaAndSampleDocuments(
    abortSignal?: AbortSignal
  ): Promise<undefined> {
    if (this._queryGenerationState === QUERY_GENERATION_STATE.FETCH_SCHEMA) {
      this._queryGenerationState = QUERY_GENERATION_STATE.DEFAULT;
    }

    const dataService = this._connectionController.getActiveDataService();
    if (!dataService || !this._databaseName || !this._collectionName) {
      return;
    }

    try {
      const sampleDocuments =
        (await dataService?.sample?.(
          `${this._databaseName}.${this._collectionName}`,
          {
            query: {},
            size: NUM_DOCUMENTS_TO_SAMPLE,
          },
          { promoteValues: false },
          {
            abortSignal,
          }
        )) || [];

      const schema = await getSimplifiedSchema(sampleDocuments);
      this._schema = new SchemaFormatter().format(schema);

      const useSampleDocsInCopilot = !!vscode.workspace
        .getConfiguration('mdb')
        .get('useSampleDocsInCopilot');

      if (useSampleDocsInCopilot) {
        this._sampleDocuments = getSimplifiedSampleDocuments(sampleDocuments);
      }
    } catch (err: any) {
      this._schema = undefined;
      this._sampleDocuments = undefined;
    }
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  async handleQueryRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ChatResult> {
    // TODO: Reset this._queryGenerationState to QUERY_GENERATION_STATE.DEFAULT
    // when a command other than /query is called, as it disrupts the flow.
    this._ifNewChatResetQueryGenerationState(context);

    if (this._shouldAskToConnectIfNotConnected(stream)) {
      return {
        metadata: {
          responseType: 'connections',
        },
      };
    }

    const shouldAskForNamespace = await this._shouldAskForNamespace(
      request,
      context,
      stream,
      token
    );
    if (shouldAskForNamespace) {
      await this._askForNamespace(stream);
      return { metadata: { responseType: 'namespaces' } };
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    if (this._shouldFetchCollectionSchema()) {
      await this._fetchCollectionSchemaAndSampleDocuments(
        abortController.signal
      );
    }

    const messages = await QueryPrompt.buildMessages({
      request,
      context,
      databaseName: this._databaseName,
      collectionName: this._collectionName,
      schema: this._schema,
      sampleDocuments: this._sampleDocuments,
    });
    const responseContent = await this.getChatResponseContent({
      messages,
      stream,
      token,
    });

    stream.markdown(responseContent);
    this._queryGenerationState = QUERY_GENERATION_STATE.DEFAULT;

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

    return {
      metadata: { responseContent: runnableContent, responseType: 'query' },
    };
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

    if (!request.prompt || request.prompt.trim().length === 0) {
      const messages = await this.handleEmptyQueryRequest();
      for (const msg of messages) {
        stream.markdown(msg);
      }
      return { metadata: { responseType: 'empty' } };
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
      this._chatResult = await this.handleQueryRequest(...args);
    } else if (request.command === 'docs') {
      // TODO(VSCODE-570): Implement this.
    } else if (request.command === 'schema') {
      // TODO(VSCODE-571): Implement this.
    } else {
      this._chatResult = await this.handleGenericRequest(...args);
    }

    return this._chatResult;
  }

  handleUserFeedback(feedback: vscode.ChatResultFeedback): void {
    this._telemetryService.trackCopilotParticipantFeedback({
      feedback: chatResultFeedbackKindToTelemetryValue(feedback.kind),
      reason: feedback.unhelpfulReason,
      response_type: (feedback.result as ChatResult)?.metadata.responseType,
    });
  }
}
