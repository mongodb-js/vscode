import type * as vscode from 'vscode';
import type { ParticipantTelemetryMetadata } from '../telemetry';

export type ParticipantCommandType = 'query' | 'schema' | 'docs' | 'doctor';
export type ParticipantCommand = `/${ParticipantCommandType}`;

export type ParticipantRequestType = ParticipantCommandType | 'generic';

export type ParticipantResponseType =
  | 'query'
  | 'schema'
  | 'docs'
  | 'docs/chatbot'
  | 'docs/copilot'
  | 'doctor'
  | 'exportToPlayground'
  | 'generic'
  | 'emptyRequest'
  | 'cancelledRequest'
  | 'askToConnect'
  | 'askForNamespace';

/** Based on options from Copilot's chat open command IChatViewOpenOptions */
export type SendMessageToParticipantOptions = {
  message: string;
  command?: ParticipantCommandType;
  isNewChat?: boolean;
  isPartialQuery?: boolean;
  telemetry?: ParticipantTelemetryMetadata;
};

export type SendMessageToParticipantFromInputOptions = Pick<
  SendMessageToParticipantOptions,
  'isNewChat' | 'isPartialQuery' | 'command' | 'telemetry'
> &
  vscode.InputBoxOptions;
