import * as vscode from 'vscode';

import { CHAT_PARTICIPANT_ID } from '../constants';

export function getHistoryMessages({
  context,
}: {
  context: vscode.ChatContext;
}): vscode.LanguageModelChatMessage[] {
  const messages: vscode.LanguageModelChatMessage[] = [];

  console.log('context history', context.history);

  // TODO: Only use the latest messages about connection, database, and collection.
  // TODO: Strip the extra things, blank message, etc.

  context.history.map((historyItem) => {
    if (
      historyItem.participant === CHAT_PARTICIPANT_ID &&
      historyItem instanceof vscode.ChatRequestTurn
    ) {
      // eslint-disable-next-line new-cap
      messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
    }

    if (historyItem instanceof vscode.ChatResponseTurn) {
      let res = '';
      for (const fragment of historyItem.response) {
        if (
          fragment instanceof vscode.ChatResponseMarkdownPart &&
          historyItem.result.metadata?.responseContent
        ) {
          res += fragment.value.value;
        }
      }
      // eslint-disable-next-line new-cap
      messages.push(vscode.LanguageModelChatMessage.Assistant(res));
    }
  });

  return messages;
}

// TODO: A user could mistakenly write one of these which would mess up our parsing.
// We could possible mistake the command for the database or collection name.
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

  context.history.map(
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
