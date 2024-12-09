import type * as vscode from 'vscode';
import type { DocumentSource } from '../documentSource';

export type ParticipantCommandType = 'query' | 'schema' | 'docs';
export type ParticipantCommand = `/${ParticipantCommandType}`;

export type ParticipantRequestType = ParticipantCommandType | 'generic';

export type ParticipantResponseType =
  | 'query'
  | 'schema'
  | 'docs'
  | 'docs/chatbot'
  | 'docs/copilot'
  | 'exportToPlayground'
  | 'generic'
  | 'emptyRequest'
  | 'cancelledRequest'
  | 'askToConnect'
  | 'askForNamespace';

type TelemetryMetadata = {
  source: DocumentSource;
  source_details?: 'database' | 'collection';
};

/** Based on options from Copilot's chat open command IChatViewOpenOptions */
export type SendMessageToParticipantOptions = {
  message: string;
  command?: ParticipantCommandType;
  isNewChat?: boolean;
  isPartialQuery?: boolean;
  telemetry?: TelemetryMetadata;
};

export type SendMessageToParticipantFromInputOptions = Pick<
  SendMessageToParticipantOptions,
  'isNewChat' | 'isPartialQuery' | 'command' | 'telemetry'
> &
  vscode.InputBoxOptions;
