import * as vscode from 'vscode';

import type { PromptArgsBase } from './promptBase';
import { PromptBase } from './promptBase';

export class GenericPrompt extends PromptBase<PromptArgsBase> {
  protected getAssistantPrompt(): string {
    return `You are a MongoDB expert.
Your task is to help the user with MongoDB related questions.
When applicable, you may suggest MongoDB code, queries, and aggregation pipelines that perform their task.
Rules:
1. Keep your response concise.
2. You should suggest code that is performant and correct.
3. Respond with markdown.
4. When relevant, provide code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.
5. Use MongoDB shell syntax for code unless the user requests a specific language.
6. If you require additional information to provide a response, ask the user for it.
7. When specifying a database, use the MongoDB syntax use('databaseName').`;
  }

  public getEmptyRequestResponse(): string {
    return vscode.l10n.t(
      'Ask anything about MongoDB, from writing queries to questions about your cluster.'
    );
  }
}
