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
  sourceDetails?: string;
};

/** Based on options from Copilot's chat open command IChatViewOpenOptions */
export type SendMessageToParticipantOptions = {
  message: string;
  command?: ParticipantCommandType;
  isNewChat?: boolean;
  isPartialQuery?: boolean;
  metadata?: TelemetryMetadata;
  /**
   * Any previous chat requests and responses that should be shown in the chat view.
   * Note that currently these requests do not end up included in vscode's context.history.
   */
  previousRequests?: {
    request: string;
    response: string;
  }[];
};

export type SendMessageToParticipantFromInputOptions = Pick<
  SendMessageToParticipantOptions,
  'isNewChat' | 'isPartialQuery' | 'command' | 'metadata'
> &
  vscode.InputBoxOptions;
