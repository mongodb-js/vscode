import * as vscode from 'vscode';

export class ExportToPlaygroundPrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Your task is to help the user build MongoDB queries and aggregation pipelines that perform their task.
You convert user's code written in any programming language to the MongoDB Shell syntax.
Take a user promt as an input string and translate it to the MongoDB Shell language.
Keep your response concise.
You should suggest queries that are performant and correct.
Respond with markdown, suggest code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.
Respond in MongoDB shell syntax using the \`\`\`javascript code block syntax.`;

    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.Assistant(prompt);
  }

  static getUserPrompt(prompt: string): vscode.LanguageModelChatMessage {
    // eslint-disable-next-line new-cap
    return vscode.LanguageModelChatMessage.User(prompt);
  }

  static buildMessages(prompt: string): vscode.LanguageModelChatMessage[] {
    const messages = [
      ExportToPlaygroundPrompt.getAssistantPrompt(),
      ExportToPlaygroundPrompt.getUserPrompt(prompt),
    ];

    return messages;
  }
}
