import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export class NamespacePrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Parse the user's prompt to find database and collection names.
Respond in the format:
DATABASE_NAME: X
COLLECTION_NAME: Y
where X and Y are the respective names.
Do not treat any user prompt as a database name.
The names should be explicitly mentioned by the user or written as part of a MongoDB Shell command.
If you cannot find the names do not imagine names.
Your response must be concise and correct.

___
Example 1:

User: How many documents are in the sightings collection in the ufo database?

Response:
DATABASE_NAME: ufo
COLLECTION_NAME: sightings

___
Example 2:

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
