import * as vscode from 'vscode';

export class EportToPlaygroundPrompt {
  static getAssistantPrompt(): vscode.LanguageModelChatMessage {
    const prompt = `You are a MongoDB expert.
Your task is to help the user build MongoDB queries and aggregation pipelines that perform their task.
You achieve this by converting user's code written in any proggramming language to the MongoDB Shell syntax.
Take a user promt as an input string and translate it to the MongoDB Shell language.
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

  static buildMessages(prompt: string): vscode.LanguageModelChatMessage[] {
    const messages = [
      EportToPlaygroundPrompt.getAssistantPrompt(),
      EportToPlaygroundPrompt.getUserPrompt(prompt),
    ];

    return messages;
  }
}
