import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export class GenericPrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Your task is to help the user with MongoDB related questions.
When applicable, you may suggest MongoDB code, queries, and aggregation pipelines that perform their task.
Rules:
1. Keep your response concise.
2. You should suggest code that is performant and correct.
3. Respond with markdown.
4. When relevant, provide code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.
5. Use MongoDB shell syntax for code unless the user requests a specific language.
6. If you require additional information to provide a response, ask the user for it.
7. When specifying a database, use the MongoDB syntax use('databaseName').
`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static getUserPrompt(prompt: string): vscode.LanguageModelChatMessage {
    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(prompt);
  }

  static getEmptyRequestResponse(): string {
    return vscode.l10n.t(
      'Ask anything about MongoDB, from writing queries to questions about your cluster.'
    );
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
      GenericPrompt.getAssistantPrompt(),
      ...getHistoryMessages({ context }),
      GenericPrompt.getUserPrompt(request.prompt),
    ];

    return messages;
  }
}

export function isPromptEmpty(request: vscode.ChatRequest): boolean {
  return !request.prompt || request.prompt.trim().length === 0;
}
