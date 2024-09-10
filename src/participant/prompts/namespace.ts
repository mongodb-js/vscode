import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export const DB_NAME_ID = 'DATABASE_NAME';
export const COL_NAME_ID = 'COLLECTION_NAME';

export class NamespacePrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Parse all user messages to find a database name and collection name to use with a command.
Respond in the format:
${DB_NAME_ID}: X
${COL_NAME_ID}: Y
where X and Y are the respective names.
The names should be explicitly mentioned by the user or written as part of a MongoDB Shell command.
If you cannot find the names do not imagine names.
If only one of the names is found, respond only with the found name.
Your response must be concise and correct.
When multiple databases or collections exist, respond with the most recent one.

When no names are found, respond with:
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
    const messages = [
      ...getHistoryMessages({ context, connectionNames }),
      NamespacePrompt.getAssistantPrompt(),
      NamespacePrompt.getUserPrompt(request.prompt),
    ];

    return messages;
  }
}
