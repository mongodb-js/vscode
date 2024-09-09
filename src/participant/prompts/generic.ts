import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export class GenericPrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Your task is to help the user craft MongoDB queries and aggregation pipelines that perform their task.
Keep your response concise.
You should suggest queries that are performant and correct.
Respond with markdown, suggest code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.
You can imagine the schema, collection, and database name.
Respond in MongoDB shell syntax using the \`\`\`javascript code block syntax.`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static getUserPrompt(prompt: string): vscode.LanguageModelChatMessage {
    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(prompt);
  }

  static getEmptyRequestResponse(): string {
    // TODO(VSCODE-572): Generic empty response handler
    return vscode.l10n.t(
      'Ask anything about MongoDB, from writing queries to questions about your cluster.'
    );
  }

  static buildMessages({
    context,
    request,
  }: {
    request: {
      // vscode.ChatRequest
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
