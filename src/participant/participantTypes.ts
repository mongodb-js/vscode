import type * as vscode from 'vscode';
import type { DocumentSource } from '../documentSource';

/** Based on options from Copilot's chat open command IChatViewOpenOptions */
export type SendMessageToParticipantOptions = {
  message: string;
  isNewChat?: boolean;
  isPartialQuery?: boolean;
  /**
   * Any previous chat requests and responses that should be shown in the chat view.
   * Note that currently these requests do not end up included in vscode's context.history.
   */
  previousRequests?: {
    request: string;
    response: string;
  }[];
};

export type SendMessageToParticipantFromInputOptions = {
  messagePrefix?: string;
  source?: DocumentSource;
} & Omit<SendMessageToParticipantOptions, 'message'> &
  vscode.InputBoxOptions;
