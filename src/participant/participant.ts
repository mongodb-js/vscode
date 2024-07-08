import * as vscode from 'vscode';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

import { createLogger } from '../logging';
import type { PlaygroundController } from '../editors';
import type ConnectionController from '../connectionController';
import EXTENSION_COMMANDS from '../commands';

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

interface GenAIConstants {
  useMongodbChatParticipant?: string;
  chatParticipantGenericPrompt?: string;
  chatParticipantQueryPrompt?: string;
  chatParticipantModel?: string;
}

const PARTICIPANT_ID = 'mongodb.participant';

function handleEmptyQueryRequest(participantId: string): ChatResult {
  log.info('Chat request participant id', participantId);

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

function getRunnableContentFromString(responseContent: string) {
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
  participant: vscode.ChatParticipant;
  chatResult: ChatResult;
  _connectionController: ConnectionController;
  _playgroundController: PlaygroundController;

  private _context: vscode.ExtensionContext;
  private _useMongodbChatParticipant = false;
  private _chatParticipantGenericPrompt = 'You are a MongoDB expert!';
  private _chatParticipantQueryPrompt = 'You are a MongoDB expert!';
  private _chatParticipantModel = 'gpt-3.5-turbo';

  constructor({
    context,
    connectionController,
    playgroundController,
  }: {
    context: vscode.ExtensionContext;
    connectionController: ConnectionController;
    playgroundController: PlaygroundController;
  }) {
    this.participant = this.createParticipant(context);
    this.chatResult = { metadata: { command: '' } };
    this._connectionController = connectionController;
    this._playgroundController = playgroundController;
    this._context = context;

    this._readConstants();
  }

  private _readConstants(): string | undefined {
    config({ path: path.join(this._context.extensionPath, '.env') });

    try {
      const constantsLocation = path.join(
        this._context.extensionPath,
        './constants.json'
      );
      // eslint-disable-next-line no-sync
      const constantsFile = fs.readFileSync(constantsLocation, 'utf8');
      const constants = JSON.parse(constantsFile) as GenAIConstants;

      this._useMongodbChatParticipant =
        constants.useMongodbChatParticipant === 'true';
      this._chatParticipantGenericPrompt =
        constants.chatParticipantGenericPrompt ||
        this._chatParticipantGenericPrompt;
      this._chatParticipantQueryPrompt =
        constants.chatParticipantQueryPrompt ||
        this._chatParticipantQueryPrompt;
      this._chatParticipantModel =
        constants.chatParticipantModel || this._chatParticipantModel;
    } catch (error) {
      log.error('An error occurred while reading the constants file', error);
      return;
    }
  }

  createParticipant(context: vscode.ExtensionContext) {
    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    const cat = vscode.chat.createChatParticipant(
      PARTICIPANT_ID,
      this.chatHandler.bind(this)
    );
    cat.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      'images',
      'mongodb.png'
    );
    return cat;
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
        family: this._chatParticipantModel,
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
      vscode.LanguageModelChatMessage.Assistant(
        this._chatParticipantGenericPrompt
      ),
    ];

    context.history.map((historyItem) => {
      if (
        historyItem.participant === PARTICIPANT_ID &&
        historyItem instanceof vscode.ChatRequestTurn
      ) {
        // eslint-disable-next-line new-cap
        messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
      }

      if (
        historyItem.participant === PARTICIPANT_ID &&
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
      return handleEmptyQueryRequest(this.participant.id);
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
      vscode.LanguageModelChatMessage.Assistant(
        this._chatParticipantQueryPrompt
      ),
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
    if (!this._useMongodbChatParticipant) {
      stream.markdown(
        vscode.l10n.t(
          'Under construction. Will be available soon. Stay tuned!\n\n'
        )
      );
      return { metadata: { command: '' } };
    }

    if (request.command === 'query') {
      this.chatResult = await this.handleQueryRequest({
        request,
        context,
        stream,
        token,
      });
      return this.chatResult;
    } else if (request.command === 'docs') {
      // TODO: Implement this.
    } else if (request.command === 'schema') {
      // TODO: Implement this.
    } else if (request.command === 'logs') {
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
