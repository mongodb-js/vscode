import * as vscode from 'vscode';
import type { DataService } from 'mongodb-data-service';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import type { LoadedConnection } from '../storage/connectionStorage';
import EXTENSION_COMMANDS from '../commands';
import type { StorageController } from '../storage';
import { StorageVariables } from '../storage';
import { GenericPrompt } from './prompts/generic';
import { CHAT_PARTICIPANT_ID } from './constants';
import { QueryPrompt } from './prompts/query';
import { NamespacePrompt } from './prompts/namespace';

const log = createLogger('participant');

enum QUERY_GENERATION_STATE {
  DEFAULT = 'DEFAULT',
  ASK_TO_CONNECT = 'ASK_TO_CONNECT',
  ASK_FOR_DATABASE_NAME = 'ASK_FOR_DATABASE_NAME',
  ASK_FOR_COLLECTION_NAME = 'ASK_FOR_COLLECTION_NAME',
  READY_TO_GENERATE_QUERY = 'READY_TO_GENERATE_QUERY',
}

interface ChatResult extends vscode.ChatResult {
  metadata: {
    responseContent?: string;
  };
}

export const CHAT_PARTICIPANT_MODEL = 'gpt-4o';

const DB_NAME_ID = 'DATABASE_NAME';
const DB_NAME_REGEX = `${DB_NAME_ID}: (.*)\n`;

const COL_NAME_ID = 'COLLECTION_NAME';
const COL_NAME_REGEX = `${COL_NAME_ID}: (.*)`;

function parseForDatabaseAndCollectionName(text: string): {
  databaseName?: string;
  collectionName?: string;
} {
  const databaseName = text.match(DB_NAME_REGEX)?.[1];
  const collectionName = text.match(COL_NAME_REGEX)?.[1];

  return { databaseName, collectionName };
}

export function getRunnableContentFromString(text: string) {
  const matchedJSresponseContent = text.match(/```javascript((.|\n)*)```/);
  log.info('matchedJSresponseContent', matchedJSresponseContent);

  const responseContent =
    matchedJSresponseContent && matchedJSresponseContent.length > 1
      ? matchedJSresponseContent[1]
      : '';
  log.info('responseContent', responseContent);
  return responseContent;
}

export class ParticipantController {
  _participant?: vscode.ChatParticipant;
  _connectionController: ConnectionController;
  _storageController: StorageController;
  _queryGenerationState?: QUERY_GENERATION_STATE;
  _chatResult?: ChatResult;
  _databaseName?: string;
  _collectionName?: string;

  constructor({
    connectionController,
    storageController,
  }: {
    connectionController: ConnectionController;
    storageController: StorageController;
  }) {
    this._connectionController = connectionController;
    this._storageController = storageController;
  }

  createParticipant(context: vscode.ExtensionContext) {
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
    return this._participant;
  }

  getParticipant(context: vscode.ExtensionContext) {
    return this._participant || this.createParticipant(context);
  }

  handleEmptyQueryRequest(stream: vscode.ChatResponseStream): undefined {
    let message;
    switch (this._queryGenerationState) {
      case QUERY_GENERATION_STATE.ASK_TO_CONNECT:
        message =
          'Please select a cluster to connect by clicking on an item in the connections list.';
        break;
      case QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME:
        message =
          'Please select a database by either clicking on an item in the list or typing the name manually in the chat.';
        break;
      case QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME:
        message =
          'Please select a collection by either clicking on an item in the list or typing the name manually in the chat.';
        break;
      default:
        message =
          'Please specify a question when using this command. Usage: @MongoDB /query find documents where "name" contains "database".';
    }
    stream.markdown(vscode.l10n.t(`${message}\n\n`));
    return;
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
    let responseContent = '';
    try {
      const [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: CHAT_PARTICIPANT_MODEL,
      });
      if (model) {
        const chatResponse = await model.sendRequest(messages, {}, token);
        for await (const fragment of chatResponse.text) {
          responseContent += fragment;
        }
      }
    } catch (err) {
      this.handleError(err, stream);
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

      return { metadata: { responseContent: runnableContent } };
    }

    return { metadata: {} };
  }

  async connectWithParticipant(id: string): Promise<boolean> {
    if (!id) {
      await this._connectionController.connectWithURI();
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

  // TODO (VSCODE-589): Evaluate the usability of displaying all existing connections in the list.
  // Consider introducing a "recent connections" feature to display only a limited number of recent connections,
  // with a "Show more" link that opens the Command Palette for access to the full list.
  // If we implement this, the "Add new connection" link may become redundant,
  // as this option is already available in the Command Palette dropdown.
  getConnectionsTree(): vscode.MarkdownString[] {
    return [
      this._createMarkdownLink({
        commandId: 'mdb.connectWithParticipant',
        name: 'Add new connection',
      }),
      ...Object.values(this._connectionController._connections)
        .sort((connectionA: LoadedConnection, connectionB: LoadedConnection) =>
          (connectionA.name || '').localeCompare(connectionB.name || '')
        )
        .map((conn: LoadedConnection) =>
          this._createMarkdownLink({
            commandId: 'mdb.connectWithParticipant',
            query: conn.id,
            name: conn.name,
          })
        ),
    ];
  }

  async selectDatabaseWithParticipant(name: string): Promise<boolean> {
    this._databaseName = name;
    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /query ${name}`,
    });
  }

  async selectCollectionWithParticipant(name: string): Promise<boolean> {
    this._collectionName = name;
    return vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /query ${name}`,
    });
  }

  // TODO (VSCODE-589): Display only 10 items in clickable lists with the show more option.
  async getDatabasesTree(
    dataService: DataService
  ): Promise<vscode.MarkdownString[]> {
    try {
      const databases = await dataService.listDatabases({
        nameOnly: true,
      });
      return databases.map((db) =>
        this._createMarkdownLink({
          commandId: 'mdb.selectDatabaseWithParticipant',
          query: db.name,
          name: db.name,
        })
      );
    } catch (error) {
      // Users can always do this manually when asked to provide a database name.
      return [];
    }
  }

  // TODO (VSCODE-589): Display only 10 items in clickable lists with the show more option.
  async getCollectionTree(
    dataService: DataService
  ): Promise<vscode.MarkdownString[]> {
    if (!this._databaseName) {
      return [];
    }

    try {
      const collections = await dataService.listCollections(this._databaseName);
      return collections.map((coll) =>
        this._createMarkdownLink({
          commandId: 'mdb.selectCollectionWithParticipant',
          query: coll.name,
          name: coll.name,
        })
      );
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
      this._databaseName = undefined;
      this._collectionName = undefined;
    }
  }

  _waitingForUserToProvideNamespace(prompt: string): boolean {
    if (
      !this._queryGenerationState ||
      ![
        QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME,
        QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME,
      ].includes(this._queryGenerationState)
    ) {
      return false;
    }

    if (
      this._queryGenerationState ===
      QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME
    ) {
      this._databaseName = prompt;
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
      this._collectionName = prompt;
      if (!this._databaseName) {
        this._queryGenerationState =
          QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME;
        return true;
      }
      this._queryGenerationState =
        QUERY_GENERATION_STATE.READY_TO_GENERATE_QUERY;
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

    this._databaseName = namespace.databaseName || this._databaseName;
    this._collectionName = namespace.collectionName || this._collectionName;

    if (namespace.databaseName && namespace.collectionName) {
      this._queryGenerationState =
        QUERY_GENERATION_STATE.READY_TO_GENERATE_QUERY;
      return false;
    }

    return true;
  }

  async _askForNamespace(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream
  ): Promise<undefined> {
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      this._queryGenerationState = QUERY_GENERATION_STATE.ASK_TO_CONNECT;
      return;
    }

    // If no database or collection name is found in the user prompt,
    // we retrieve the available namespaces from the current connection.
    // Users can then select a value by clicking on an item in the list.
    if (!this._databaseName) {
      const tree = await this.getDatabasesTree(dataService);
      stream.markdown(
        'What is the name of the database you would like this query to run against?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
      this._queryGenerationState = QUERY_GENERATION_STATE.ASK_FOR_DATABASE_NAME;
    } else if (!this._collectionName) {
      const tree = await this.getCollectionTree(dataService);
      stream.markdown(
        'Which collection would you like to query within this database?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
      this._queryGenerationState =
        QUERY_GENERATION_STATE.ASK_FOR_COLLECTION_NAME;
    }

    return;
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
      return { metadata: {} };
    }

    const shouldAskForNamespace = await this._shouldAskForNamespace(
      request,
      context,
      stream,
      token
    );

    if (shouldAskForNamespace) {
      await this._askForNamespace(request, stream);
      return { metadata: {} };
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    const messages = QueryPrompt.buildMessages({
      request,
      context,
      databaseName: this._databaseName,
      collectionName: this._collectionName,
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

    return { metadata: { responseContent: runnableContent } };
  }

  async chatHandler(
    ...args: [
      vscode.ChatRequest,
      vscode.ChatContext,
      vscode.ChatResponseStream,
      vscode.CancellationToken
    ]
  ): Promise<void> {
    const [request, , stream] = args;
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
      return;
    } else if (request.command === 'docs') {
      // TODO(VSCODE-570): Implement this.
    } else if (request.command === 'schema') {
      // TODO(VSCODE-571): Implement this.
    }

    await this.handleGenericRequest(...args);
  }
}
