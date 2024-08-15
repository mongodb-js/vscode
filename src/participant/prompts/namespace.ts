import * as vscode from 'vscode';

export class NamespacePrompt {
  static getSystemPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert!
    Parse the user's prompt to find database and collection names.
    Respond in the format \nDATABASE_NAME: X\nCOLLECTION_NAME: Y\n where X and Y are the names.
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
    request,
  }: {
    request: vscode.ChatRequest;
    context?: vscode.ChatContext;
  }): vscode.LanguageModelChatMessage[] {
    const messages = [
      NamespacePrompt.getSystemPrompt(),
      NamespacePrompt.getUserPrompt(request),
    ];

    return messages;
  }
}
