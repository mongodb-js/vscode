import * as vscode from 'vscode';
import type { PromptArgsBase } from './promptBase';
import { PromptBase } from './promptBase';

export class GenericPrompt extends PromptBase<PromptArgsBase> {
  protected getAssistantPrompt(): string {
    return `You are a MongoDB expert.
Your task is to help the user craft MongoDB queries and aggregation pipelines that perform their task.
Keep your response concise.
You should suggest queries that are performant and correct.
Respond with markdown, suggest code in a Markdown code block that begins with \`\`\`javascript and ends with \`\`\`.
You can imagine the schema, collection, and database name.
Respond in MongoDB shell syntax using the \`\`\`javascript code block syntax.`;
  }

  protected getUserPrompt(args: PromptArgsBase): Promise<string> {
    return Promise.resolve(args.request.prompt);
  }

  public getEmptyRequestResponse(): string {
    // TODO(VSCODE-572): Generic empty response handler
    return vscode.l10n.t(
      'Ask anything about MongoDB, from writing queries to questions about your cluster.'
    );
  }
}
