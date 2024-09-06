import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export const DB_NAME_ID = 'DATABASE_NAME';
export const COL_NAME_ID = 'COLLECTION_NAME';

export class NamespacePrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Parse the user's prompt to find database and collection names.
Respond in the format:
${DB_NAME_ID}: X
${COL_NAME_ID}: Y
where X and Y are the respective names.
Do not treat any user prompt as a database name.
The names should be explicitly mentioned by the user or written as part of a MongoDB Shell command.
If you cannot find the names do not imagine names.
If only one of the names is found, respond only with the found name.
Your response must be concise and correct.

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
  }: {
    request: {
      prompt: string;
    };
    context: vscode.ChatContext;
  }): vscode.LanguageModelChatMessage[] {
    const messages = [
      NamespacePrompt.getAssistantPrompt(),
      ...getHistoryMessages({ context }),
      NamespacePrompt.getUserPrompt(request.prompt),
    ];

    return messages;
  }
}
