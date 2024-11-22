import type * as vscode from 'vscode';

export type SendMessageToParticipantOptions = {
  message: string;
  isNewChat?: boolean;
  isPartialQuery?: boolean;
};

export type SendMessageToParticipantFromInputOptions = {
  messagePrefix?: string;
} & Omit<SendMessageToParticipantOptions, 'message'> &
  vscode.InputBoxOptions;
