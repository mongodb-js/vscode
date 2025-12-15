import * as vscode from 'vscode';
import { ParticipantErrorType } from '../participantErrorTypes';
import type { ChatResult } from '../constants';
import type { ParticipantResponseType } from '../participantTypes';

export class PromptHistory {
  private static _handleChatResponseTurn({
    currentTurn,
    namespaceIsKnown,
  }: {
    currentTurn: vscode.ChatResponseTurn;
    namespaceIsKnown: boolean;
  }): vscode.LanguageModelChatMessage | undefined {
    if (
      currentTurn.result.errorDetails?.message === ParticipantErrorType.filtered
    ) {
      return undefined;
    }

    let message = '';

    // Skip a response to an empty user prompt message or connect message.
    const responseTypesToSkip: ParticipantResponseType[] = [
      'emptyRequest',
      'askToConnect',
    ];

    const responseType = (currentTurn.result as ChatResult)?.metadata?.intent;
    if (responseTypesToSkip.includes(responseType)) {
      // eslint-disable-next-line new-cap
      return undefined;
    }

    // If the namespace is already known, skip including prompts asking for it.
    if (responseType === 'askForNamespace' && namespaceIsKnown) {
      // eslint-disable-next-line new-cap
      return undefined;
    }

    for (const fragment of currentTurn.response) {
      if (fragment instanceof vscode.ChatResponseMarkdownPart) {
        message += fragment.value.value;

        if (
          (currentTurn.result as ChatResult)?.metadata?.intent ===
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
    return vscode.LanguageModelChatMessage.Assistant(message);
  }

  private static _handleChatRequestTurn({
    previousTurn,
    currentTurn,
    nextTurn,
    connectionNames,
    namespaceIsKnown,
  }: {
    previousTurn: vscode.ChatRequestTurn | vscode.ChatResponseTurn | undefined;
    currentTurn: vscode.ChatRequestTurn;
    nextTurn: vscode.ChatRequestTurn | vscode.ChatResponseTurn | undefined;
    connectionNames: string[] | undefined;
    namespaceIsKnown: boolean;
  }): vscode.LanguageModelChatMessage | undefined {
    if (previousTurn instanceof vscode.ChatResponseTurn) {
      const responseIntent = (previousTurn.result as ChatResult).metadata
        ?.intent;

      if (responseIntent === 'askForNamespace' && namespaceIsKnown) {
        // If the namespace is already known, skip responses to prompts asking for it.
        return undefined;
      }
    }

    if (
      nextTurn instanceof vscode.ChatResponseTurn &&
      nextTurn.result.errorDetails?.message === ParticipantErrorType.filtered
    ) {
      // If the response to this request led to a filtered error,
      // we do not want to include it in the history
      return undefined;
    }

    if (
      currentTurn.prompt?.trim().length === 0 ||
      connectionNames?.includes(currentTurn.prompt)
    ) {
      // When the message is empty or a connection name then we skip it.
      // It's probably going to be the response to the connect step.
      return undefined;
    }

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(currentTurn.prompt);
  }

  /** When passing the history to the model we only want contextual messages
  to be passed. This function parses through the history and returns
  the messages that are valuable to keep. */
  static async getFilteredHistory({
    model,
    tokenLimit,
    connectionNames,
    history,
    namespaceIsKnown,
  }: {
    model?: vscode.LanguageModelChat | undefined;
    tokenLimit?: number;
    connectionNames?: string[]; // Used to scrape the connecting messages from the history.
    history?: vscode.ChatContext['history'];
    namespaceIsKnown: boolean;
  }): Promise<vscode.LanguageModelChatMessage[]> {
    const messages: vscode.LanguageModelChatMessage[] = [];

    if (!history) {
      return [];
    }

    let totalUsedTokens = 0;

    for (let i = history.length - 1; i >= 0; i--) {
      const currentTurn = history[i];

      let addedMessage: vscode.LanguageModelChatMessage | undefined;
      if (currentTurn instanceof vscode.ChatRequestTurn) {
        const previousTurn = i - 1 >= 0 ? history[i - 1] : undefined;
        const nextTurn = i + 1 < history.length ? history[i + 1] : undefined;

        addedMessage = this._handleChatRequestTurn({
          previousTurn,
          currentTurn,
          nextTurn,
          connectionNames,
          namespaceIsKnown,
        });
      } else if (currentTurn instanceof vscode.ChatResponseTurn) {
        addedMessage = this._handleChatResponseTurn({
          currentTurn,
          namespaceIsKnown,
        });
      }
      if (addedMessage) {
        if (tokenLimit) {
          totalUsedTokens += (await model?.countTokens(addedMessage)) || 0;
          if (totalUsedTokens > tokenLimit) {
            break;
          }
        }

        messages.push(addedMessage);
      }
    }

    return messages.reverse();
  }

  /** The docs chatbot keeps its own history so we avoid any
   * we need to include history only since last docs message. */
  static async getFilteredHistoryForDocs({
    connectionNames,
    context,
    databaseName,
    collectionName,
  }: {
    connectionNames?: string[];
    context?: vscode.ChatContext;
    databaseName?: string;
    collectionName?: string;
  }): Promise<vscode.LanguageModelChatMessage[]> {
    if (!context) {
      return [];
    }
    const historySinceLastDocs: (
      | vscode.ChatRequestTurn
      | vscode.ChatResponseTurn
    )[] = [];

    /** Limit included messages' history to prevent prompt overflow. */
    const MAX_DOCS_HISTORY_LENGTH = 4;

    for (let i = context.history.length - 1; i >= 0; i--) {
      const message = context.history[i];

      if (
        message.command === 'docs' ||
        historySinceLastDocs.length >= MAX_DOCS_HISTORY_LENGTH
      ) {
        break;
      }
      historySinceLastDocs.push(context.history[i]);
    }
    return this.getFilteredHistory({
      connectionNames,
      history: historySinceLastDocs.reverse(),
      namespaceIsKnown:
        databaseName !== undefined && collectionName !== undefined,
    });
  }
}
