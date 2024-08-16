import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export class NamespacePrompt {
  static getSystemPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert!
Parse the user's prompt to find database and collection names.
Respond in the format \nDATABASE_NAME: X\nCOLLECTION_NAME: Y\n where X and Y are the names.
Do not threat any user pronpt as a database name. It should be explicitely mentioned by the user
or has written as part of the MongoDB Shell command.
If you wan't able to find X or Y do not imagine names.
This is a first phase before we create the code, only respond with the collection name and database name.`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static getUserPrompt(
    request: vscode.ChatRequest
  ): vscode.LanguageModelChatMessage {
    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(request.prompt);
  }

  static buildMessages({
    context,
    request,
  }: {
    request: vscode.ChatRequest;
    context: vscode.ChatContext;
  }): vscode.LanguageModelChatMessage[] {
    const messages = [
      NamespacePrompt.getSystemPrompt(),
      ...getHistoryMessages({ context }),
      NamespacePrompt.getUserPrompt(request),
    ];

    return messages;
  }
}
