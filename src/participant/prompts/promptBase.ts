import * as vscode from 'vscode';
import type { ChatResult, ParticipantResponseType } from '../constants';

export interface PromptArgsBase {
  request: {
    prompt: string;
    command?: string;
  };
  context?: vscode.ChatContext;
  connectionNames?: string[];
}

export abstract class PromptBase<TArgs extends PromptArgsBase> {
  protected abstract getAssistantPrompt(args: TArgs): string;

  protected getUserPrompt(args: TArgs): Promise<string> {
    return Promise.resolve(args.request.prompt);
  }

  async buildMessages(args: TArgs): Promise<vscode.LanguageModelChatMessage[]> {
    let historyMessages = this.getHistoryMessages(args);
    // If the current user's prompt is a connection name, and the last
    // message was to connect. We want to use the last
    // message they sent before the connection name as their prompt.
    if (args.connectionNames?.includes(args.request.prompt)) {
      const history = args.context?.history;
      if (!history) {
        return [];
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

    return [
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.Assistant(this.getAssistantPrompt(args)),
      ...historyMessages,
      // eslint-disable-next-line new-cap
      vscode.LanguageModelChatMessage.User(await this.getUserPrompt(args)),
    ];
  }

  // When passing the history to the model we only want contextual messages
  // to be passed. This function parses through the history and returns
  // the messages that are valuable to keep.
  // eslint-disable-next-line complexity
  protected getHistoryMessages({
    connectionNames,
    context,
  }: {
    connectionNames?: string[]; // Used to scrape the connecting messages from the history.
    context?: vscode.ChatContext;
  }): vscode.LanguageModelChatMessage[] {
    const messages: vscode.LanguageModelChatMessage[] = [];

    if (!context) {
      return [];
    }

    for (const historyItem of context.history) {
      if (historyItem instanceof vscode.ChatRequestTurn) {
        if (
          historyItem.prompt?.trim().length === 0 ||
          connectionNames?.includes(historyItem.prompt)
        ) {
          // When the message is empty or a connection name then we skip it.
          // It's probably going to be the response to the connect step.
          continue;
        }

        // eslint-disable-next-line new-cap
        messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
      }

      if (historyItem instanceof vscode.ChatResponseTurn) {
        let message = '';

        // Skip a response to an empty user prompt message or connect message.
        const responseTypesToSkip: ParticipantResponseType[] = [
          'emptyRequest',
          'askToConnect',
        ];
        if (
          responseTypesToSkip.indexOf(
            (historyItem.result as ChatResult)?.metadata?.intent
          ) > -1
        ) {
          continue;
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
    }

    return messages;
  }
}
