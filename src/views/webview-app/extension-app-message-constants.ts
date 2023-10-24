import type LegacyConnectionModel from './connection-model/legacy-connection-model';
import type { FilePickerActionTypes } from './store/actions';

export enum CONNECTION_STATUS {
  LOADING = 'LOADING', // When the connection status has not yet been shared from the extension.
  CONNECTED = 'CONNECTED',
  CONNECTING = 'CONNECTING',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED',
}

export const VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID =
  'VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID';

export enum MESSAGE_TYPES {
  CONNECT = 'CONNECT',
  CONNECT_RESULT = 'CONNECT_RESULT',
  CONNECTION_STATUS_MESSAGE = 'CONNECTION_STATUS_MESSAGE',
  EXTENSION_LINK_CLICKED = 'EXTENSION_LINK_CLICKED',
  CREATE_NEW_PLAYGROUND = 'CREATE_NEW_PLAYGROUND',
  FILE_PICKER_RESULTS = 'FILE_PICKER_RESULTS',
  GET_CONNECTION_STATUS = 'GET_CONNECTION_STATUS',
  OPEN_CONNECTION_STRING_INPUT = 'OPEN_CONNECTION_STRING_INPUT',
  OPEN_FILE_PICKER = 'OPEN_FILE_PICKER',
  OPEN_MOCK_DATA_GENERATOR = 'OPEN_MOCK_DATA_GENERATOR',
  OPEN_TRUSTED_LINK = 'OPEN_TRUSTED_LINK',
  RENAME_ACTIVE_CONNECTION = 'RENAME_ACTIVE_CONNECTION',
  INSERT_MOCK_DATA = 'INSERT_MOCK_DATA',
  SEND_AI_PROMPT = 'SEND_AI_PROMPT',
  RECIEVE_AI_RESPONSE = 'RECIEVE_AI_RESPONSE'
}

interface BasicWebviewMessage {
  command: string;
}

export interface CreateNewPlaygroundMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CREATE_NEW_PLAYGROUND;
}

export interface InsertMockDataMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.INSERT_MOCK_DATA;
  codeToEvaluate: string;
}

export interface ConnectionStatusMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE;
  connectionStatus: CONNECTION_STATUS;
  activeConnectionName: string;
}

export interface ConnectMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECT;
  connectionModel: LegacyConnectionModel;
  connectionAttemptId: string;
}

export interface SendAiPromptMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.SEND_AI_PROMPT;
  aiPrompt: string;
}

export interface ConnectResultsMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECT_RESULT;
  connectionSuccess: boolean;
  connectionMessage: string;
  connectionAttemptId: string;
}

export interface GetConnectionStatusMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.GET_CONNECTION_STATUS;
}

export interface OpenConnectionStringInputMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT;
}

export interface OpenMockDataGenerator extends BasicWebviewMessage {
  command: MESSAGE_TYPES.OPEN_MOCK_DATA_GENERATOR;
}

// Note: In the app this is tightly coupled with 'externals.ts'.
export interface OpenFilePickerMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.OPEN_FILE_PICKER;
  action: FilePickerActionTypes;
  multi: boolean;
}

export interface FilePickerResultsMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.FILE_PICKER_RESULTS;
  action: FilePickerActionTypes;
  files: string[] | undefined;
}
export interface RecieveAIResponseMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.RECIEVE_AI_RESPONSE;
  respnse: any;
}

export interface LinkClickedMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.EXTENSION_LINK_CLICKED;
  screen: string;
  linkId: string;
}

export interface OpenTrustedLinkMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.OPEN_TRUSTED_LINK;
  linkTo: string;
}

export interface RenameConnectionMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.RENAME_ACTIVE_CONNECTION;
}

export type MESSAGE_FROM_WEBVIEW_TO_EXTENSION =
  | ConnectMessage
  | CreateNewPlaygroundMessage
  | InsertMockDataMessage
  | GetConnectionStatusMessage
  | LinkClickedMessage
  | OpenConnectionStringInputMessage
  | OpenFilePickerMessage
  | OpenTrustedLinkMessage
  | RenameConnectionMessage
  | SendAiPromptMessage;

export type MESSAGE_FROM_EXTENSION_TO_WEBVIEW =
  | ConnectResultsMessage
  | FilePickerResultsMessage
  | ConnectionStatusMessage
  | OpenMockDataGenerator
  | RecieveAIResponseMessage;
