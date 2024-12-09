import * as vscode from 'vscode';
import type { ChatResult } from '../constants';
import type {
  InternalPromptPurpose,
  ParticipantPromptProperties,
} from '../../telemetry/telemetryService';
import { PromptHistory } from './promptHistory';
import type { ParticipantCommandType } from '../participantTypes';
import { getCopilotModel } from '../model';

export interface PromptArgsBase {
  request: {
    prompt: string;
    command?: string;
  };
  context?: vscode.ChatContext;
  connectionNames?: string[];
  databaseName?: string;
  collectionName?: string;
}

export interface UserPromptResponse {
  prompt: string;
  hasSampleDocs: boolean;
}

export interface ModelInput {
  messages: vscode.LanguageModelChatMessage[];
  stats: ParticipantPromptProperties;
}

export function getContentLength(
  message: vscode.LanguageModelChatMessage
): number {
  const content = message.content as any;
  if (typeof content === 'string') {
    return content.trim().length;
  }

  // TODO: https://github.com/microsoft/vscode/pull/231788 made it so message.content is no longer a string,
  // but an array of things that a message can contain. This will eventually be reflected in the type definitions
  // but until then, we're manually checking the array contents to ensure we don't break when this PR gets released
  // in the stable channel.
  if (Array.isArray(content)) {
    return content.reduce((acc: number, element) => {
      const value = element?.value ?? element?.content?.value;
      if (typeof value === 'string') {
        return acc + value.length;
      }

      return acc;
    }, 0);
  }

  return 0;
}

export function getContent(message: vscode.LanguageModelChatMessage): string {
  const content = message.content as any;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.reduce((agg: string, element) => {
      const value = element?.value ?? element?.content?.value;
      if (typeof value === 'string') {
        return agg + value;
      }

      return agg;
    }, '');
  }

  return '';
}

export function isContentEmpty(
  message: vscode.LanguageModelChatMessage
): boolean {
  const content = message.content as any;
  if (typeof content === 'string') {
    return content.trim().length === 0;
  }

  if (Array.isArray(content)) {
    for (const element of content) {
      const value = element?.value ?? element?.content?.value;
      if (typeof value === 'string' && value.trim().length > 0) {
        return false;
      }
    }
  }

  return true;
}

export abstract class PromptBase<PromptArgs extends PromptArgsBase> {
  protected abstract getAssistantPrompt(args: PromptArgs): string;

  protected get internalPurposeForTelemetry(): InternalPromptPurpose {
    return undefined;
  }

  protected getUserPrompt({
    request,
  }: PromptArgs): Promise<UserPromptResponse> {
    return Promise.resolve({
      prompt: request.prompt,
      hasSampleDocs: false,
    });
  }

  private async _countRemainingTokens({
    model,
    assistantPrompt,
    requestPrompt,
  }: {
    model: vscode.LanguageModelChat | undefined;
    assistantPrompt: vscode.LanguageModelChatMessage;
    requestPrompt: string;
  }): Promise<number | undefined> {
    if (model) {
      const [assistantPromptTokens, userPromptTokens] = await Promise.all([
        model.countTokens(assistantPrompt),
        model.countTokens(requestPrompt),
      ]);
      return model.maxInputTokens - (assistantPromptTokens + userPromptTokens);
    }
    return undefined;
  }

  async buildMessages(args: PromptArgs): Promise<ModelInput> {
    const { context, request, databaseName, collectionName, connectionNames } =
      args;

    const model = await getCopilotModel();

    // eslint-disable-next-line new-cap
    const assistantPrompt = vscode.LanguageModelChatMessage.Assistant(
      this.getAssistantPrompt(args)
    );

    const tokenLimit = await this._countRemainingTokens({
      model,
      assistantPrompt,
      requestPrompt: request.prompt,
    });

    let historyMessages = await PromptHistory.getFilteredHistory({
      history: context?.history,
      model,
      tokenLimit,
      namespaceIsKnown:
        databaseName !== undefined && collectionName !== undefined,
      connectionNames,
    });

    // If the current user's prompt is a connection name, and the last
    // message was to connect. We want to use the last
    // message they sent before the connection name as their prompt.
    if (connectionNames?.includes(request.prompt)) {
      const history = context?.history;
      if (!history) {
        return {
          messages: [],
          stats: this.getStats([], { request, context }, false),
        };
      }
      const previousResponse = history[
        history.length - 1
      ] as vscode.ChatResponseTurn;
      const intent = (previousResponse?.result as ChatResult)?.metadata.intent;
      if (intent === 'askToConnect') {
        // Go through the history in reverse order to find the last user message.
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i] instanceof vscode.ChatRequestTurn) {
            request.prompt = (history[i] as vscode.ChatRequestTurn).prompt;
            // Rewrite the arguments so that the prompt is the last user message from history
            args = {
              ...args,
              request,
            };

            // Remove the item from the history messages array.
            historyMessages = historyMessages.slice(0, i);
            break;
          }
        }
      }
    }

    const { prompt, hasSampleDocs } = await this.getUserPrompt(args);
    // eslint-disable-next-line new-cap
    const userPrompt = vscode.LanguageModelChatMessage.User(prompt);

    const messages = [assistantPrompt, ...historyMessages, userPrompt];

    return {
      messages,
      stats: this.getStats(messages, { request, context }, hasSampleDocs),
    };
  }

  protected getStats(
    messages: vscode.LanguageModelChatMessage[],
    { request, context }: Pick<PromptArgsBase, 'request' | 'context'>,
    hasSampleDocs: boolean
  ): ParticipantPromptProperties {
    return {
      total_message_length: messages.reduce(
        (acc, message) => acc + getContentLength(message),
        0
      ),
      user_input_length: request.prompt.length,
      has_sample_documents: hasSampleDocs,
      command: (request.command as ParticipantCommandType) || 'generic',
      history_size: context?.history.length || 0,
      internal_purpose: this.internalPurposeForTelemetry,
    };
  }
}
