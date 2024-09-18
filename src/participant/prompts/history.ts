import * as vscode from 'vscode';
import type { ChatResult, ParticipantResponseType } from '../constants';

// When passing the history to the model we only want contextual messages
// to be passed. This function parses through the history and returns
// the messages that are valuable to keep.
// eslint-disable-next-line complexity
export function getHistoryMessages({
  connectionNames,
  context,
}: {
  connectionNames?: string[]; // Used to scrape the connecting messages from the history.
  context: vscode.ChatContext;
}): vscode.LanguageModelChatMessage[] {
  const messages: vscode.LanguageModelChatMessage[] = [];

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
          (historyItem.result as ChatResult)?.metadata.intent
        ) > -1
      ) {
        continue;
      }

      for (const fragment of historyItem.response) {
        if (fragment instanceof vscode.ChatResponseMarkdownPart) {
          message += fragment.value.value;

          if (
            (historyItem.result as ChatResult)?.metadata.intent ===
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

export function doesLastMessageAskForNamespace(
  history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>
): boolean {
  const lastMessageMetaData: vscode.ChatResponseTurn | undefined = history[
    history.length - 1
  ] as vscode.ChatResponseTurn;

  return (
    (lastMessageMetaData?.result as ChatResult)?.metadata?.intent ===
    'askForNamespace'
  );
}
