import * as vscode from 'vscode';

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

enum QUERY_GENERATION_STATUS {
  ASK_TO_CONNECT = 'ASK_TO_CONNECT',
  ASK_FOR_DATABASE_NAME = 'ASK_FOR_DATABASE_NAME',
  ASK_FOR_COLLECTION_NAME = 'ASK_FOR_COLLECTION_NAME',
  READY_TO_GENERATE_QUERY = 'READY_TO_GENERATE_QUERY',
  QUERY_GENERATED = 'QUERY_GENERATED',
}

interface ChatResult extends vscode.ChatResult {
  metadata?: {
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
  _chatResult?: ChatResult;
  _connectionController: ConnectionController;
  _storageController: StorageController;
  _queryGenerationStatus?: QUERY_GENERATION_STATUS;
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

  handleEmptyQueryRequest(): ChatResult {
    return {
      errorDetails: {
        message:
          'Please specify a question when using this command. Usage: @MongoDB /query find documents where "name" contains "database".',
      },
    };
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
  ) {
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

      return { metadata: { responseContent } };
    }

    return;
  }

  async _printAndCallParticipantCommand({
    command,
    query,
  }: {
    command: string;
    query?: string;
  }): Promise<boolean> {
    // We don't want yet users to call these commands from the chat,
    // therefore we enable them only to be called programmatically by the participant.
    // Currently, /connect, /database, and /collection commands are part of the query generation flow.
    // If we allow users to call them directly, they will call the /query command to complete the sequence.
    // That might be unexpected for users if they want just to change the current namespace.
    // but it returns a generated query in a Chat response.
    // We will explore in the future possible ways to debound these commands.
    // See https://github.com/microsoft/vscode/issues/225516
    void vscode.commands.executeCommand(
      'setContext',
      'mdb.isCalledByParticipant',
      true
    );
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: `@MongoDB /${command} ${query}`,
    });
    return vscode.commands.executeCommand(
      'setContext',
      'mdb.isCalledByParticipant',
      false
    );
  }

  async connectWithParticipant(id: string): Promise<boolean> {
    if (!id) {
      await this._connectionController.connectWithURI();
    } else {
      await this._connectionController.connectWithConnectionId(id);
    }

    const connectionName = this._connectionController.getActiveConnectionName();
    return this._printAndCallParticipantCommand({
      command: 'connect',
      query: connectionName,
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
  }) {
    const commandQuery = query ? `?%5B%22${query}%22%5D` : '';
    const connName = new vscode.MarkdownString(
      `- <a href="command:${commandId}${commandQuery}">${name}</a>\n`
    );
    connName.supportHtml = true;
    connName.isTrusted = { enabledCommands: [commandId] };
    return connName;
  }

  getConnectionsTree(): vscode.MarkdownString[] {
    if (!Object.values(this._connectionController._connections).length) {
      return [];
    }

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
    return this._printAndCallParticipantCommand({
      command: 'database',
      query: name,
    });
  }

  async selectCollectionWithParticipant(name: string): Promise<boolean> {
    return this._printAndCallParticipantCommand({
      command: 'collection',
      query: name,
    });
  }

  async getDatabasesTree(): Promise<vscode.MarkdownString[]> {
    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      return [];
    }

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
      return [];
    }
  }

  async getCollectionTree(): Promise<vscode.MarkdownString[]> {
    if (!this._databaseName) {
      return [];
    }

    const dataService = this._connectionController.getActiveDataService();
    if (dataService === null) {
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
      return [];
    }
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  // eslint-disable-next-line complexity
  async handleQueryRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) {
    // Check if this is a new chat.
    const isNewChat = !context.history.find(
      (historyItem) => historyItem.participant === CHAT_PARTICIPANT_ID
    );

    if (isNewChat) {
      this._databaseName = undefined;
      this._collectionName = undefined;
    }

    if (!request.prompt || request.prompt.trim().length === 0) {
      return this.handleEmptyQueryRequest();
    }

    // Ask to connect if not connected.
    const dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      const tree = this.getConnectionsTree();
      stream.markdown(
        "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n"
      );
      for (const item of tree) {
        stream.markdown(item);
      }
      this._queryGenerationStatus = QUERY_GENERATION_STATUS.ASK_TO_CONNECT;
      return;
    }

    // Look for a namespace in the prompt.
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

    if (namespace.databaseName) {
      this._databaseName = namespace.databaseName;
    }
    if (namespace.collectionName) {
      this._collectionName = namespace.collectionName;
    }

    if (!this._collectionName) {
      this._queryGenerationStatus =
        QUERY_GENERATION_STATUS.ASK_FOR_COLLECTION_NAME;
    }
    if (!this._databaseName) {
      this._queryGenerationStatus =
        QUERY_GENERATION_STATUS.ASK_FOR_DATABASE_NAME;
    }

    // If we could not find a database or collection name in the user prompt,
    // we fetch available namespaces from the current connection.
    // Users can select a value by clicking on the list item.
    if (
      this._queryGenerationStatus ===
      QUERY_GENERATION_STATUS.ASK_FOR_DATABASE_NAME
    ) {
      const tree = await this.getDatabasesTree();
      stream.markdown(
        'What is the name of the database you would like this query to run against?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
      if (this._collectionName) {
        this._queryGenerationStatus =
          QUERY_GENERATION_STATUS.READY_TO_GENERATE_QUERY;
      } else {
        this._queryGenerationStatus =
          QUERY_GENERATION_STATUS.ASK_FOR_COLLECTION_NAME;
      }
      return;
    } else if (
      this._queryGenerationStatus ===
      QUERY_GENERATION_STATUS.ASK_FOR_COLLECTION_NAME
    ) {
      const tree = await this.getCollectionTree();
      stream.markdown(
        'Which collection would you like to query within this database?\n\n'
      );
      for (const item of tree) {
        stream.markdown(item);
      }
      if (!this._databaseName) {
        this._databaseName = request.prompt;
      }
      this._queryGenerationStatus =
        QUERY_GENERATION_STATUS.READY_TO_GENERATE_QUERY;
      return;
    } else if (
      this._queryGenerationStatus ===
      QUERY_GENERATION_STATUS.READY_TO_GENERATE_QUERY
    ) {
      this._collectionName = request.prompt;
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
    this._queryGenerationStatus = QUERY_GENERATION_STATUS.QUERY_GENERATED;

    const runnableContent = getRunnableContentFromString(responseContent);

    if (!runnableContent || runnableContent.trim().length === 0) {
      return;
    }

    stream.button({
      command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
      title: vscode.l10n.t('▶️ Run'),
    });
    stream.button({
      command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
      title: vscode.l10n.t('Open in playground'),
    });

    return { metadata: { responseContent } };
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
  Please see our [FAQ](https://www.mongodb.com/docs/generative-ai-faq/) for more information.`)
      );
      void this._storageController.update(
        StorageVariables.COPILOT_HAS_BEEN_SHOWN_WELCOME_MESSAGE,
        true
      );
    }

    if (request.command === 'query') {
      this._chatResult = await this.handleQueryRequest(...args);
      return;
    } else if (request.command === 'connect') {
      // The query can be already generated and returned to the chat,
      // but users still can click on the connections in the list to change the current cluster.
      stream.markdown(vscode.l10n.t('MongoDB connection successful.\n\n'));
      if (
        this._queryGenerationStatus !== QUERY_GENERATION_STATUS.QUERY_GENERATED
      ) {
        this._chatResult = await this.handleQueryRequest(...args);
      }
      return;
    } else if (request.command === 'database') {
      this._databaseName = request.prompt;
      this._chatResult = await this.handleQueryRequest(...args);
      return;
    } else if (request.command === 'collection') {
      this._collectionName = request.prompt;
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
