import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export const DB_NAME_ID = 'DATABASE_NAME';
export const COL_NAME_ID = 'COLLECTION_NAME';

export class NamespacePrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Parse all user messages to find a database name and a collection name.
Respond in the format:
${DB_NAME_ID}: X
${COL_NAME_ID}: Y
where X and Y are the respective names.
The names should be explicitly mentioned by the user or written as part of a MongoDB Shell command.
If you cannot find the names do not imagine names.
If only one of the names is found, respond only with the found name.
Your response must be concise and correct.

When no names are found, respond with:
No names found.

___
Example 1:
User: How many documents are in the sightings collection in the ufo database?
Response:
${DB_NAME_ID}: ufo
${COL_NAME_ID}: sightings
___
Example 2:
User: How do I create an index in my pineapples collection?
Response:
${COL_NAME_ID}: pineapples
___
Example 3:
User: Where is the best hummus in Berlin?
Response:
No names found.
`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static getUserPrompt(prompt: string): vscode.LanguageModelChatMessage {
    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(prompt);
  }

  static buildMessages({
    context,
    request,
    connectionNames,
  }: {
    request: {
      prompt: string;
    };
    context: vscode.ChatContext;
    connectionNames: string[];
  }): vscode.LanguageModelChatMessage[] {
    let historyMessages = getHistoryMessages({ context, connectionNames });
    // If the current user's prompt is a connection name, and the last
    // message was to connect. We want to use the last
    // message they sent before the connection name as their prompt.
    let userPrompt = request.prompt;
    if (
      connectionNames.includes(request.prompt) &&
      (context.history[context.history.length - 1] as vscode.ChatResponseTurn)
        ?.result?.metadata?.askToConnect
    ) {
      // Go through the history in reverse order to find the last user message.
      for (let i = historyMessages.length - 1; i >= 0; i--) {
        if (
          historyMessages[i].role === vscode.LanguageModelChatMessageRole.User
        ) {
          userPrompt = historyMessages[i].content;
          // Remove the item from the history messages array.
          historyMessages = historyMessages.slice(0, i);
          break;
        }
      }
    }

    const messages = [
      NamespacePrompt.getAssistantPrompt(),
      ...historyMessages,
      NamespacePrompt.getUserPrompt(userPrompt),
    ];

    return messages;
  }
}
