import type * as vscode from 'vscode';

export type SendMessageToParticipantOptions = {
  message: string;
  isNewChat?: boolean;
  isPartialQuery?: boolean;
};

export type SendMessageToParticipantFromInputOptions = {
  messagePrefix?: string;
  source?: 'query with copilot codelens';
} & Omit<SendMessageToParticipantOptions, 'message'> &
  vscode.InputBoxOptions;
