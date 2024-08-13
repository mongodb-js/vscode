import * as vscode from 'vscode';

import { getHistoryMessages } from './history';

export class QueryPrompt {
  static getSystemPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Your task is to help the user craft MongoDB queries and aggregation pipelines that perform their task.
Keep your response concise.
You should suggest queries that are performant and correct.
Respond with markdown, suggest code in a Markdown code block that begins with \'\'\'javascript and ends with \`\`\`.
You can imagine the schema, collection, and database name.
Respond in MongoDB shell syntax using the \'\'\'javascript code block syntax.`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static getUserPrompt(request: {
    // vscode.ChatRequest
    prompt: string;
  }): vscode.LanguageModelChatMessage {
    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(request.prompt);
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
      QueryPrompt.getSystemPrompt(),
      ...getHistoryMessages({ context }),
      QueryPrompt.getUserPrompt(request),
    ];

    return messages;
  }
}
