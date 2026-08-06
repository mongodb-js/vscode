import * as vscode from 'vscode';
import type { ChatResult } from '../constants';
import type {
  InternalPromptPurpose,
  ParticipantPromptProperties,
} from '../../telemetry';
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

/**
 * A message can contain tool calls and data alongside text, so we only pull out
 * the text parts.
 */
function getTextParts(message: vscode.LanguageModelChatMessage): string[] {
  return message.content.flatMap((part) =>
    part instanceof vscode.LanguageModelTextPart ? [part.value] : [],
  );
}

export function getContentLength(
  message: vscode.LanguageModelChatMessage,
): number {
  return getTextParts(message).reduce((acc, value) => acc + value.length, 0);
}

export function getContent(message: vscode.LanguageModelChatMessage): string {
  return getTextParts(message).join('');
}

export function isContentEmpty(
  message: vscode.LanguageModelChatMessage,
): boolean {
  return getTextParts(message).every((value) => value.trim().length === 0);
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

    const assistantPrompt = vscode.LanguageModelChatMessage.Assistant(
      this.getAssistantPrompt(args),
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
    hasSampleDocs: boolean,
  ): ParticipantPromptProperties {
    return {
      totalMessageLength: messages.reduce(
        (acc, message) => acc + getContentLength(message),
        0,
      ),
      userInputLength: request.prompt.length,
      hasSampleDocuments: hasSampleDocs,
      command: (request.command as ParticipantCommandType) || 'generic',
      historySize: context?.history.length || 0,
      internalPurpose: this.internalPurposeForTelemetry,
    };
  }
}
