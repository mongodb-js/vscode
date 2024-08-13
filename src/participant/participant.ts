import * as vscode from 'vscode';

import { createLogger } from '../logging';
import type ConnectionController from '../connectionController';
import EXTENSION_COMMANDS from '../commands';
import type { StorageController } from '../storage';
import { StorageVariables } from '../storage';

const log = createLogger('participant');

interface ChatResult extends vscode.ChatResult {
  metadata: {
    command: string;
    databaseName?: string;
    collectionName?: string;
    queryContent?: string;
    description?: string;
  };
  stream?: vscode.ChatResponseStream;
}

export const CHAT_PARTICIPANT_ID = 'mongodb.participant';
export const CHAT_PARTICIPANT_MODEL = 'gpt-4o';

export function getRunnableContentFromString(responseContent: string) {
  const matchedJSQueryContent = responseContent.match(
    /```javascript((.|\n)*)```/
  );
  log.info('matchedJSQueryContent', matchedJSQueryContent);

  const queryContent =
    matchedJSQueryContent && matchedJSQueryContent.length > 1
      ? matchedJSQueryContent[1]
      : '';
  log.info('queryContent', queryContent);
  return queryContent;
}

export class ParticipantController {
  _participant?: vscode.ChatParticipant;
  _chatResult: ChatResult;
  _connectionController: ConnectionController;
  _storageController: StorageController;

  constructor({
    connectionController,
    storageController,
  }: {
    connectionController: ConnectionController;
    storageController: StorageController;
  }) {
    this._chatResult = { metadata: { command: '' } };
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
      metadata: {
        command: '',
      },
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

    const queryContent = getRunnableContentFromString(responseContent);

    if (queryContent && queryContent.trim().length) {
      stream.button({
        command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
        title: vscode.l10n.t('▶️ Run'),
      });

      stream.button({
        command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
        title: vscode.l10n.t('Open in playground'),
      });

      return {
        metadata: {
          command: '',
          stream,
          queryContent,
        },
      };
    }

    return { metadata: { command: '' } };
  }

  // @MongoDB /query find all documents where the "address" has the word Broadway in it.
  async handleQueryRequest({
    request,
    stream,
    token,
  }: {
    request: vscode.ChatRequest;
    context?: vscode.ChatContext;
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
        return { metadata: { command: '' } };
      }

      stream.markdown(
        `Connected to "${this._connectionController.getActiveConnectionName()}".\n\n`
      );
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => {
      abortController.abort();
    });

    const messages = [
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.Assistant(`You are a MongoDB expert!
  You create MongoDB queries and aggregation pipelines,
  and you are very good at it. The user will provide the basis for the query.
  Keep your response concise. Respond with markdown, code snippets are possible with '''javascript.
  You can imagine the schema, collection, and database name.
  Respond in MongoDB shell syntax using the '''javascript code style.`),
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.User(request.prompt),
    ];
    const responseContent = await this.getChatResponseContent({
      messages,
      stream,
      token,
    });
    const queryContent = getRunnableContentFromString(responseContent);

    if (!queryContent || queryContent.trim().length === 0) {
      return { metadata: { command: '' } };
    }

    stream.button({
      command: EXTENSION_COMMANDS.RUN_PARTICIPANT_QUERY,
      title: vscode.l10n.t('▶️ Run'),
    });
    stream.button({
      command: EXTENSION_COMMANDS.OPEN_PARTICIPANT_QUERY_IN_PLAYGROUND,
      title: vscode.l10n.t('Open in playground'),
    });

    return {
      metadata: {
        command: '',
        stream,
        queryContent,
      },
    };
  }

  async chatHandler(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<ChatResult> {
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
