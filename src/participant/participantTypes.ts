import type * as vscode from 'vscode';
import type { DocumentSource } from '../documentSource';

export type SendMessageToParticipantOptions = {
  message: string;
  isNewChat?: boolean;
  isPartialQuery?: boolean;
};

export type SendMessageToParticipantFromInputOptions = {
  messagePrefix?: string;
  source?: DocumentSource;
} & Omit<SendMessageToParticipantOptions, 'message'> &
  vscode.InputBoxOptions;
