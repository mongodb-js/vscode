import * as vscode from 'vscode';

import { CHAT_PARTICIPANT_ID } from '../constants';

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
    if (
      historyItem.participant === CHAT_PARTICIPANT_ID &&
      historyItem instanceof vscode.ChatRequestTurn &&
      historyItem.prompt?.trim().length > 0 // Skip empty prompts.
    ) {
      if (connectionNames?.includes(historyItem.prompt)) {
        // When the message is a connection name then we skip it.
        // It's probably going to be the response to the connect step.
        continue;
      }

      // eslint-disable-next-line new-cap
      messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
    }

    if (historyItem instanceof vscode.ChatResponseTurn) {
      let message = '';

      if (historyItem.result.metadata?.isEmptyResponse) {
        // Skip a response to an empty user prompt message.
        continue;
      }

      if (historyItem.result.metadata?.askToConnect) {
        // Skip a response to the connect message.
        continue;
      }

      for (const fragment of historyItem.response) {
        if (fragment instanceof vscode.ChatResponseMarkdownPart) {
          message += fragment.value.value;

          if (historyItem.result.metadata?.askForNamespace) {
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

// A user could mistakenly write one of these which would mess up our parsing.
// To fix this we either need to pass metadata with the command, which
// is doesn't look like it possible, or we need to have a more complex
// message key, like using a special symbol for this regex (although a user could
// copy paste this themselves and get into another weird state).
export const databaseNameInCommandResponseKey = 'Database: ';
const databaseNameInCommandResponseKeyRegex = `^${databaseNameInCommandResponseKey}(.*)`;
export const collectionNameInCommandResponseKey = 'Collection: ';
const collectionNameInCommandResponseKeyRegex = `^${collectionNameInCommandResponseKey}(.*)`;

export function getLatestDatabaseAndCollectionFromChatHistory({
  request,
  context,
}: {
  request: vscode.ChatRequest;
  context: vscode.ChatContext;
}): {
  databaseName: string | undefined;
  collectionName: string | undefined;
} {
  let databaseName: string | undefined;
  let collectionName: string | undefined;

  context.history.forEach(
    (historyItem: vscode.ChatRequestTurn | vscode.ChatResponseTurn, index) => {
      if (historyItem instanceof vscode.ChatResponseTurn) {
        const possibleNamespaceResponse =
          (context.history[index - 1] as vscode.ChatRequestTurn).prompt || '';
        const databaseNameMatch = possibleNamespaceResponse.match(
          databaseNameInCommandResponseKeyRegex
        )?.[1];
        databaseName = databaseNameMatch || databaseName;
        const collectionNameMatch = possibleNamespaceResponse.match(
          collectionNameInCommandResponseKeyRegex
        )?.[1];
        collectionName = collectionNameMatch || collectionName;

        if (historyItem.result.metadata?.databaseName) {
          databaseName = historyItem.result.metadata?.databaseName;
        }
        if (historyItem.result.metadata?.collectionName) {
          collectionName = historyItem.result.metadata?.collectionName;
        }
      }
    }
  );

  if (request.prompt) {
    // See if the request the user just made has part of the namespace.
    const databaseNameMatch = request.prompt.match(
      databaseNameInCommandResponseKeyRegex
    )?.[1];
    databaseName = databaseNameMatch || databaseName;
    const collectionNameMatch = request.prompt.match(
      collectionNameInCommandResponseKeyRegex
    )?.[1];
    collectionName = collectionNameMatch || collectionName;
  }

  return {
    databaseName,
    collectionName,
  };
}
