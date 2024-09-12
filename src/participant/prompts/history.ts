import * as vscode from 'vscode';
import type {
  AskToConnectChatResult,
  EmptyRequestChatResult,
  NamespaceRequestChatResult,
} from '../constants';

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

      if (
        (historyItem.result as EmptyRequestChatResult).metadata
          ?.isEmptyResponse ||
        (historyItem.result as AskToConnectChatResult).metadata?.askToConnect
      ) {
        // Skip a response to an empty user prompt message or connect message.
        continue;
      }

      for (const fragment of historyItem.response) {
        if (fragment instanceof vscode.ChatResponseMarkdownPart) {
          message += fragment.value.value;

          if (
            (historyItem.result as NamespaceRequestChatResult).metadata
              ?.askForNamespace
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

// A user could mistakenly write one of these which would mess up our parsing.
// To fix this we either need to pass metadata with the command, which
// is doesn't look like it possible, or we need to have a more complex
// message key, like using a special symbol for this regex (although a user could
// copy paste this themselves and get into another weird state).
export const databaseNameInCommandResponseKey = 'Database: ';
const databaseNameInCommandResponseKeyRegex = `^${databaseNameInCommandResponseKey}(.*)`;
export const collectionNameInCommandResponseKey = 'Collection: ';
const collectionNameInCommandResponseKeyRegex = `^${collectionNameInCommandResponseKey}(.*)`;

// eslint-disable-next-line complexity
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

  if (request.prompt) {
    // See if the request the user just made has part of the namespace.
    const databaseNameMatch = request.prompt.match(
      databaseNameInCommandResponseKeyRegex
    )?.[1];
    databaseName = databaseNameMatch || databaseName;
    const collectionNameMatch = request.prompt.match(
      collectionNameInCommandResponseKeyRegex
    )?.[1];
    collectionName = collectionNameMatch ?? collectionName;

    if (databaseName && collectionName) {
      return {
        databaseName,
        collectionName,
      };
    }
  }

  // Reverse order, returns on the first match found.
  for (let i = context.history.length - 1; i >= 0; i--) {
    const historyItem: vscode.ChatRequestTurn | vscode.ChatResponseTurn =
      context.history[i];
    if (historyItem instanceof vscode.ChatRequestTurn) {
      const possibleNamespaceResponse = historyItem.prompt || '';
      databaseName =
        possibleNamespaceResponse.match(
          databaseNameInCommandResponseKeyRegex
        )?.[1] ?? databaseName;
      collectionName =
        possibleNamespaceResponse.match(
          collectionNameInCommandResponseKeyRegex
        )?.[1] ?? collectionName;
    }

    if (historyItem instanceof vscode.ChatResponseTurn) {
      databaseName =
        (historyItem.result as NamespaceRequestChatResult).metadata
          ?.databaseName ?? databaseName;
      collectionName =
        (historyItem.result as NamespaceRequestChatResult).metadata
          ?.collectionName ?? collectionName;
    }

    if (databaseName && collectionName) {
      return {
        databaseName,
        collectionName,
      };
    }
  }

  return {
    databaseName,
    collectionName,
  };
}
