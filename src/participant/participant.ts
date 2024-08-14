import * as vscode from 'vscode';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import EXTENSION_COMMANDS from '../commands';

const log = createLogger('participant');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const util = require('util');

enum QUERY_GENERATION_STATUS {
  QUERY_INITIALISED = 'QUERY_INITIALISED',
  DATABASE_REQUESTED_FROM_USER = 'DATABASE_REQUESTED_FROM_USER',
  COLLECTION_REQUESTED_FROM_USER = 'COLLECTION_REQUESTED_FROM_USER',
  QUERY_GENERATED = 'QUERY_GENERATED',
}

interface ChatResult extends vscode.ChatResult {
  metadata?: {
    responseContent?: string;
  };
}

export const CHAT_PARTICIPANT_ID = 'mongodb.participant';
export const CHAT_PARTICIPANT_MODEL = 'gpt-4o';

export function getRunnableContentFromString(response: string) {
  const matchedJSresponseContent = response.match(/```javascript((.|\n)*)```/);
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
  _queryPrompts: string[] = [];
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
          stream.markdown(fragment);
        }
        stream.markdown('\n\n');
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
    if (!request.prompt || request.prompt.trim().length === 0) {
      return this.handleEmptyQueryRequest();
    }

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

    const isNewChat = !context.history.find(
      (historyItem) => historyItem.participant === CHAT_PARTICIPANT_ID
    );

    if (isNewChat) {
      this._queryGenerationStatus = QUERY_GENERATION_STATUS.QUERY_INITIALISED;
      this._queryPrompts = [];
    }

    if (
      this._queryGenerationStatus === QUERY_GENERATION_STATUS.QUERY_INITIALISED
    ) {
      stream.markdown(
        'What is the name of the database you would like this query to run against?\n\n'
      );
      this._queryGenerationStatus =
        QUERY_GENERATION_STATUS.DATABASE_REQUESTED_FROM_USER;
      this._queryPrompts.push(request.prompt);
      return;
    } else if (
      this._queryGenerationStatus ===
      QUERY_GENERATION_STATUS.DATABASE_REQUESTED_FROM_USER
    ) {
      stream.markdown(
        'And which collection would you like to query within this database?\n\n'
      );
      this._queryGenerationStatus =
        QUERY_GENERATION_STATUS.COLLECTION_REQUESTED_FROM_USER;
      this._databaseName = request.prompt;
      return;
    } else if (
      this._queryGenerationStatus ===
      QUERY_GENERATION_STATUS.COLLECTION_REQUESTED_FROM_USER
    ) {
      this._collectionName = request.prompt;
    } else if (
      this._queryGenerationStatus === QUERY_GENERATION_STATUS.QUERY_GENERATED
    ) {
      this._queryPrompts.push(request.prompt);
    }

    console.log('this._queryPrompts----------------------');
    console.log(`${util.inspect(this._queryPrompts)}`);
    console.log('----------------------');

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
  The user will provide the basis for the query.
  Keep your response concise.
  Respond with markdown, code snippets.
  Respond in MongoDB shell syntax using the '''javascript code style.
  Examples of generated playground:

  Example 1:
  ---
  use('CURRENT_DATABASE');

  db.getCollection('CURRENT_COLLECTION').aggregate([
    // Find all of the sales that occurred in 2014.
    { $match: { date: { $gte: new Date('2014-01-01'), $lt: new Date('2015-01-01') } } },
    // Group the total sales for each product.
    { $group: { _id: '$item', totalSaleAmount: { $sum: { $multiply: [ '$price', '$quantity' ] } } } }
  ]);
  ---

  Example 2:
  ---
  use('CURRENT_DATABASE');

  db.getCollection('CURRENT_COLLECTION').find({
    date: { $gte: new Date('2014-04-04'), $lt: new Date('2014-04-05') }
  }).count();

  ---

  Where:
    - Filtering criteria: ${this._queryPrompts?.join(', ')}
    - CURRENT_DATABASE: ${databaseName}
    - CURRENT_COLLECTION: ${collectionName}

  You can use any MongoDB Shell syntax, not only aggregate or find.`),
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.User(request.prompt),
    ];
    const responseContent = await this.getChatResponseContent({
      messages,
      stream,
      token,
    });

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
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ChatResult | undefined> {
    if (request.command === 'query') {
      this._chatResult = await this.handleQueryRequest({
        request,
        context,
        stream,
        token,
      });
      return this._chatResult;
    } else if (request.command === 'docs') {
      // TODO: Implement this.
    } else if (request.command === 'schema') {
      // TODO: Implement this.
    }

    return await this.handleGenericRequest({
      request,
      context,
      stream,
      token,
    });
  }
}
