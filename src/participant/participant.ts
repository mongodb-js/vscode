import * as vscode from 'vscode';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import EXTENSION_COMMANDS from '../commands';

const log = createLogger('participant');

enum QUERY_GENERATION_STATUS {
  ASK_FOR_DATABASE_NAME = 'ASK_FOR_DATABASE_NAME',
  ASK_FOR_COLLECTION_NAME = 'ASK_FOR_COLLECTION_NAME',
  READY_TO_GENERATE_QUERY = 'READY_TO_GENERATE_QUERY',
}

interface ChatResult extends vscode.ChatResult {
  metadata?: {
    responseContent?: string;
  };
}

export const CHAT_PARTICIPANT_ID = 'mongodb.participant';
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

  _queryGenerationStatus?: QUERY_GENERATION_STATUS;
  _databaseName?: string;
  _collectionName?: string;

  constructor({
    connectionController,
  }: {
    connectionController: ConnectionController;
  }) {
    this._connectionController = connectionController;
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
  async handleGenericRequest({
    request,
    context,
    stream,
    token,
  }: {
    request: vscode.ChatRequest;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }) {
    const messages = [
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.Assistant(`You are a MongoDB expert!
  You create MongoDB queries and aggregation pipelines,
  and you are very good at it. The user will provide the basis for the query.
  Keep your response concise. Respond with markdown, code snippets are possible with '''javascript.
  You can imagine the schema, collection, and database name.
  Respond in MongoDB shell syntax using the '''javascript code style.`),
    ];

    context.history.map((historyItem) => {
      if (
        historyItem.participant === CHAT_PARTICIPANT_ID &&
        historyItem instanceof vscode.ChatRequestTurn
      ) {
        // eslint-disable-next-line new-cap
        messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
      }

      if (
        historyItem.participant === CHAT_PARTICIPANT_ID &&
        historyItem instanceof vscode.ChatResponseTurn
      ) {
        let res = '';
        for (const fragment of historyItem.response) {
          res += fragment;
        }
        // eslint-disable-next-line new-cap
        messages.push(vscode.LanguageModelChatMessage.Assistant(res));
      }
    });

    // eslint-disable-next-line new-cap
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

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

  async getDatabasesTree(): Promise<vscode.MarkdownString[]> {
    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      return [];
    }

    try {
      const databases = await dataService.listDatabases({
        nameOnly: true,
      });
      return databases.map((db) => {
        const dbName = new vscode.MarkdownString(
          `- <a href="command:workbench.action.chat.open?${db.name}">${db.name}</a>\n`
        );
        dbName.supportHtml = true;
        return dbName;
      });
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
      return collections.map((coll) => {
        const collName = new vscode.MarkdownString(
          `- <a href="command:workbench.action.chat.open?${coll.name}">${coll.name}</a>\n`
        );
        collName.supportHtml = true;
        return collName;
      });
    } catch (error) {
      return [];
    }
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  // eslint-disable-next-line complexity
  async handleQueryRequest({
    request,
    context,
    stream,
    token,
  }: {
    request: vscode.ChatRequest;
    context: vscode.ChatContext;
    stream: vscode.ChatResponseStream;
    token: vscode.CancellationToken;
  }) {
    // A user opened a new chat.
    const isNewChat = !context.history.find(
      (historyItem) => historyItem.participant === CHAT_PARTICIPANT_ID
    );

    if (isNewChat && (!request.prompt || request.prompt.trim().length === 0)) {
      return this.handleEmptyQueryRequest();
    }

    // If a user is not connected yet, open the command palette to choose from saved connections.
    let dataService = this._connectionController.getActiveDataService();
    if (!dataService) {
      stream.markdown(
        "Looks like you aren't currently connected, first let's get you connected to the cluster we'd like to create this query to run against.\n\n"
      );
      // We add a delay so the user can read the message.
      // TODO: maybe there is better way to handle this.
      // stream.button() does not awaits so we can't use it here.
      // Followups do not support input so we can't use that either.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const successfullyConnected =
        await this._connectionController.changeActiveConnection();
      dataService = this._connectionController.getActiveDataService();

      if (!dataService || !successfullyConnected) {
        stream.markdown(
          'No connection for command provided. Please use a valid connection for running commands.\n\n'
        );
        return;
      }

      stream.markdown(
        `Connected to "${this._connectionController.getActiveConnectionName()}".\n\n`
      );
    }

    if (isNewChat) {
      // Clean the old chat data.
      this._databaseName = undefined;
      this._collectionName = undefined;

      // First parse for a database and collection name.
      const messages = [
        // eslint-disable-next-line new-cap
        vscode.LanguageModelChatMessage.Assistant(`You are a MongoDB expert!
    Parse the user's prompt to find database and collection names.
    Respond in the format \nDATABASE_NAME: X\nCOLLECTION_NAME: Y\n where X and Y are the names.
    If you wan't able to find X or Y do not imagine names.
    This is a first phase before we create the code, only respond with the collection name and database name.`),
        // eslint-disable-next-line new-cap
        vscode.LanguageModelChatMessage.User(request.prompt),
      ];
      const responseContent = await this.getChatResponseContent({
        messages,
        stream,
        token,
      });

      const namespace = parseForDatabaseAndCollectionName(responseContent);

      if (namespace.databaseName) {
        this._databaseName = namespace.databaseName;
      } else {
        this._queryGenerationStatus =
          QUERY_GENERATION_STATUS.ASK_FOR_DATABASE_NAME;
      }

      if (namespace.collectionName) {
        this._collectionName = namespace.collectionName;
      } else {
        this._queryGenerationStatus = namespace.databaseName
          ? QUERY_GENERATION_STATUS.ASK_FOR_COLLECTION_NAME
          : QUERY_GENERATION_STATUS.ASK_FOR_DATABASE_NAME;
      }
    }

    // If we could not find a database and collection name in the user prompt,
    // We request them from user in chat.
    if (
      this._queryGenerationStatus ===
      QUERY_GENERATION_STATUS.ASK_FOR_DATABASE_NAME
    ) {
      const tree = await this.getDatabasesTree();
      stream.markdown(
        'What is the name of the database you would like this query to run against?\n\n'
      );
      // Currently returns plain text because ChatResponseStream.markdown
      // doesn't support links that execute commands.
      // See https://github.com/microsoft/vscode/issues/225609
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
      if (!this._databaseName) {
        this._databaseName = request.prompt;
      }
      const tree = await this.getCollectionTree();
      stream.markdown(
        'Which collection would you like to query within this database?\n\n'
      );
      // Currently returns plain text because ChatResponseStream.markdown
      // doesn't support links that execute commands.
      // See https://github.com/microsoft/vscode/issues/225609
      for (const item of tree) {
        stream.markdown(item);
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

    const databaseName = this._databaseName || 'mongodbVSCodeCopilotDB';
    const collectionName = this._collectionName || 'results';

    const messages = [
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.Assistant(`You are a MongoDB expert!

  You create MongoDB playgrounds and you are very good at it.
  A user will provide the basis for the query.
  Keep your response concise.
  Respond in MongoDB shell syntax inside a single '''javascript markdown code snippet.
  You can use only the following MongoDB Shell commands: use, aggregate, bulkWrite, countDocu, findOneAndReplace,
  findOneAndUpdate, insert, insertMany, insertOne, remove, replaceOne, update, updateMany, updateOne.

  Example 1:
  ---
  use('');

  db.getCollection('').aggregate([
    // Find all of the sales that occurred in 2014.
    { $match: { date: { $gte: new Date('2014-01-01'), $lt: new Date('2015-01-01') } } },
    // Group the total sales for each product.
    { $group: { _id: '$item', totalSaleAmount: { $sum: { $multiply: [ '$price', '$quantity' ] } } } }
  ]);
  ---

  Example 2:
  ---
  use('');

  db.getCollection('').find({
    date: { $gte: new Date('2014-04-04'), $lt: new Date('2014-04-05') }
  }).count();

  ---

  Database name: ${databaseName}
  Collection name: ${collectionName}

  Explain the code snippet you have generated.`),
    ];

    context.history.map((historyItem) => {
      if (
        historyItem.participant === CHAT_PARTICIPANT_ID &&
        historyItem instanceof vscode.ChatRequestTurn
      ) {
        // eslint-disable-next-line new-cap
        messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
      }

      if (
        historyItem.participant === CHAT_PARTICIPANT_ID &&
        historyItem instanceof vscode.ChatResponseTurn
      ) {
        let res = '';
        for (const fragment of historyItem.response) {
          res += fragment;
        }
        // eslint-disable-next-line new-cap
        messages.push(vscode.LanguageModelChatMessage.Assistant(res));
      }
    });

    // eslint-disable-next-line new-cap
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

    const responseContent = await this.getChatResponseContent({
      messages,
      stream,
      token,
    });
    stream.markdown(responseContent);

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
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (request.command === 'query') {
      this._chatResult = await this.handleQueryRequest({
        request,
        context,
        stream,
        token,
      });
      return;
    } else if (request.command === 'docs') {
      // TODO: Implement this.
    } else if (request.command === 'schema') {
      // TODO: Implement this.
    }

    await this.handleGenericRequest({
      request,
      context,
      stream,
      token,
    });
  }
}
