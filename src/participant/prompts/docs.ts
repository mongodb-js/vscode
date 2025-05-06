import type { ParticipantPromptProperties } from '../../telemetry';
import type { PromptArgsBase } from './promptBase';
import { PromptBase } from './promptBase';
import type * as vscode from 'vscode';

export class DocsPrompt extends PromptBase<PromptArgsBase> {
  protected getAssistantPrompt(): string {
    throw new Error('Method not implemented.');
  }

  public getStats(
    messages: vscode.LanguageModelChatMessage[],
    { request, context }: PromptArgsBase,
  ): ParticipantPromptProperties {
    return super.getStats(messages, { request, context }, false);
  }
}
