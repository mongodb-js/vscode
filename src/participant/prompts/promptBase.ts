import * as vscode from 'vscode';
import type { ChatResult, ParticipantResponseType } from '../constants';
import type {
  InternalPromptPurpose,
  ParticipantPromptProperties,
} from '../../telemetry/telemetryService';
import { ParticipantErrorTypes } from '../participantErrorTypes';

export interface PromptArgsBase {
  request: {
    prompt: string;
    command?: string;
  };
  context?: vscode.ChatContext;
  connectionNames?: string[];
  databaseName?: string;
  collectionName?: string;
}

export interface UserPromptResponse {
  prompt: string;
  hasSampleDocs: boolean;
}

export interface ModelInput {
  messages: vscode.LanguageModelChatMessage[];
  stats: ParticipantPromptProperties;
}

export function getContentLength(
  message: vscode.LanguageModelChatMessage
): number {
  const content = message.content as any;
  if (typeof content === 'string') {
    return content.trim().length;
  }

  // TODO: https://github.com/microsoft/vscode/pull/231788 made it so message.content is no longer a string,
  // but an array of things that a message can contain. This will eventually be reflected in the type definitions
  // but until then, we're manually checking the array contents to ensure we don't break when this PR gets released
  // in the stable channel.
  if (Array.isArray(content)) {
    return content.reduce((acc: number, element) => {
      const value = element?.value ?? element?.content?.value;
      if (typeof value === 'string') {
        return acc + value.length;
      }

      return acc;
    }, 0);
  }

  return 0;
}

export function getContent(message: vscode.LanguageModelChatMessage): string {
  const content = message.content as any;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.reduce((agg: string, element) => {
      const value = element?.value ?? element?.content?.value;
      if (typeof value === 'string') {
        return agg + value;
      }

      return agg;
    }, '');
  }

  return '';
}

export function isContentEmpty(
  message: vscode.LanguageModelChatMessage
): boolean {
  const content = message.content as any;
  if (typeof content === 'string') {
    return content.trim().length === 0;
  }

  if (Array.isArray(content)) {
    for (const element of content) {
      const value = element?.value ?? element?.content?.value;
      if (typeof value === 'string' && value.trim().length > 0) {
        return false;
      }
    }
  }

  return true;
}

export abstract class PromptBase<TArgs extends PromptArgsBase> {
  protected abstract getAssistantPrompt(args: TArgs): string;

  protected get internalPurposeForTelemetry(): InternalPromptPurpose {
    return undefined;
  }

  protected getUserPrompt(args: TArgs): Promise<UserPromptResponse> {
    return Promise.resolve({
      prompt: args.request.prompt,
      hasSampleDocs: false,
    });
  }

  async buildMessages(args: TArgs): Promise<ModelInput> {
    let historyMessages = this.getFilteredHistoryMessages({
      history: args.context?.history,
      ...args,
    });
    // If the current user's prompt is a connection name, and the last
    // message was to connect. We want to use the last
    // message they sent before the connection name as their prompt.
    if (args.connectionNames?.includes(args.request.prompt)) {
      const history = args.context?.history;
      if (!history) {
        return {
          messages: [],
          stats: this.getStats([], args, false),
        };
      }
      const previousResponse = history[
        history.length - 1
      ] as vscode.ChatResponseTurn;
      const intent = (previousResponse?.result as ChatResult)?.metadata.intent;
      if (intent === 'askToConnect') {
        // Go through the history in reverse order to find the last user message.
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i] instanceof vscode.ChatRequestTurn) {
            // Rewrite the arguments so that the prompt is the last user message from history
            args = {
              ...args,
              request: {
                ...args.request,
                prompt: (history[i] as vscode.ChatRequestTurn).prompt,
              },
            };

            // Remove the item from the history messages array.
            historyMessages = historyMessages.slice(0, i);
            break;
          }
        }
      }
    }

    const { prompt, hasSampleDocs } = await this.getUserPrompt(args);
    const messages = [
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.Assistant(this.getAssistantPrompt(args)),
      ...historyMessages,
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.User(prompt),
    ];

    return {
      messages,
      stats: this.getStats(messages, args, hasSampleDocs),
    };
  }

  protected getStats(
    messages: vscode.LanguageModelChatMessage[],
    { request, context }: TArgs,
    hasSampleDocs: boolean
  ): ParticipantPromptProperties {
    return {
      total_message_length: messages.reduce(
        (acc, message) => acc + getContentLength(message),
        0
      ),
      user_input_length: request.prompt.length,
      has_sample_documents: hasSampleDocs,
      command: request.command || 'generic',
      history_size: context?.history.length || 0,
      internal_purpose: this.internalPurposeForTelemetry,
    };
  }

  private _handleChatResponseTurn({
    messages,
    historyItem,
    namespaceIsKnown,
  }: {
    historyItem: vscode.ChatResponseTurn;
    messages: vscode.LanguageModelChatMessage[];
    namespaceIsKnown: boolean;
  }): void {
    if (
      historyItem.result.errorDetails?.message ===
      ParticipantErrorTypes.FILTERED
    ) {
      // If the response led to a filtered error, we do not want the
      // error-causing message to be sent again so we remove it.
      messages.pop();
      return;
    }

    let message = '';

    // Skip a response to an empty user prompt message or connect message.
    const responseTypesToSkip: ParticipantResponseType[] = [
      'emptyRequest',
      'askToConnect',
    ];

    const responseType = (historyItem.result as ChatResult)?.metadata?.intent;
    if (responseTypesToSkip.includes(responseType)) {
      return;
    }

    // If the namespace is already known, skip including prompts asking for it.
    if (responseType === 'askForNamespace' && namespaceIsKnown) {
      return;
    }

    for (const fragment of historyItem.response) {
      if (fragment instanceof vscode.ChatResponseMarkdownPart) {
        message += fragment.value.value;

        if (
          (historyItem.result as ChatResult)?.metadata?.intent ===
          'askForNamespace'
        ) {
          // When the message is the assistant asking for part of a namespace,
          // we only want to include the question asked, not the user's
          // database and collection names in the history item.
          break;
        }
      }
    }

    // eslint-disable-next-line new-cap
    messages.push(vscode.LanguageModelChatMessage.Assistant(message));
  }

  private _handleChatRequestTurn({
    messages,
    historyItem,
    previousItem,
    connectionNames,
    namespaceIsKnown,
  }: {
    historyItem: vscode.ChatRequestTurn;
    previousItem: vscode.ChatRequestTurn | vscode.ChatResponseTurn | undefined;
    messages: vscode.LanguageModelChatMessage[];
    connectionNames: string[] | undefined;
    namespaceIsKnown: boolean;
  }): void {
    if (
      historyItem.prompt?.trim().length === 0 ||
      connectionNames?.includes(historyItem.prompt)
    ) {
      // When the message is empty or a connection name then we skip it.
      // It's probably going to be the response to the connect step.
      return;
    }

    if (previousItem instanceof vscode.ChatResponseTurn) {
      const responseIntent = (previousItem.result as ChatResult).metadata
        ?.intent;

      if (responseIntent === 'askForNamespace' && namespaceIsKnown) {
        // If the namespace is already known, skip responses to prompts asking for it.
        return;
      }
    }

    // eslint-disable-next-line new-cap
    messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
  }

  // When passing the history to the model we only want contextual messages
  // to be passed. This function parses through the history and returns
  // the messages that are valuable to keep.
  protected getFilteredHistoryMessages({
    connectionNames,
    history,
    databaseName,
    collectionName,
  }: {
    connectionNames?: string[]; // Used to scrape the connecting messages from the history.
    history?: vscode.ChatContext['history'];
    databaseName?: string;
    collectionName?: string;
  }): vscode.LanguageModelChatMessage[] {
    const messages: vscode.LanguageModelChatMessage[] = [];

    if (!history) {
      return [];
    }

    let previousItem:
      | vscode.ChatRequestTurn
      | vscode.ChatResponseTurn
      | undefined = undefined;

    const namespaceIsKnown =
      databaseName !== undefined && collectionName !== undefined;
    for (const historyItem of history) {
      if (historyItem instanceof vscode.ChatRequestTurn) {
        this._handleChatRequestTurn({
          messages,
          historyItem,
          previousItem,
          connectionNames,
          namespaceIsKnown,
        });
      } else if (historyItem instanceof vscode.ChatResponseTurn) {
        this._handleChatResponseTurn({
          messages,
          historyItem,
          namespaceIsKnown,
        });
      }
      previousItem = historyItem;
    }

    return messages;
  }
}
