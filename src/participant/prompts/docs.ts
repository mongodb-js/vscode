import type * as vscode from 'vscode';
import type { PromptArgsBase } from './promptBase';
import { PromptBase } from './promptBase';

export class DocsPrompt extends PromptBase<PromptArgsBase> {
  protected getAssistantPrompt(): string {
    throw new Error('Not used with docs command');
  }

  getHistoryMessages({
    connectionNames,
    context,
    databaseName,
    collectionName,
  }: {
    connectionNames?: string[];
    context?: vscode.ChatContext;
    databaseName?: string;
    collectionName?: string;
  }): vscode.LanguageModelChatMessage[] {
    if (!context) {
      return [];
    }
    const historySinceLastDocs: (
      | vscode.ChatRequestTurn
      | vscode.ChatResponseTurn
    )[] = [];

    for (let i = context.history.length - 1; i >= 0; i--) {
      const message = context.history[i];

      if (message.command === 'docs') {
        break;
      }
      historySinceLastDocs.push(context.history[i]);
    }
    return this.getFilteredHistoryMessages({
      connectionNames,
      history: historySinceLastDocs,
      databaseName,
      collectionName,
    });
  }
}
