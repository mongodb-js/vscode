import type LegacyConnectionModel from './legacy/connection-model/legacy-connection-model';
import type { FilePickerActionTypes } from './legacy/store/actions';
import type { ConnectionInfo } from 'mongodb-data-service-legacy';

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
  CANCEL_CONNECT = 'CANCEL_CONNECT',
  LEGACY_CONNECT = 'LEGACY_CONNECT',
  CONNECT_RESULT = 'CONNECT_RESULT',
  CONNECTION_STATUS_MESSAGE = 'CONNECTION_STATUS_MESSAGE',
  EXTENSION_LINK_CLICKED = 'EXTENSION_LINK_CLICKED',
  CREATE_NEW_PLAYGROUND = 'CREATE_NEW_PLAYGROUND',
  FILE_PICKER_RESULTS = 'FILE_PICKER_RESULTS',
  GET_CONNECTION_STATUS = 'GET_CONNECTION_STATUS',
  OPEN_CONNECTION_STRING_INPUT = 'OPEN_CONNECTION_STRING_INPUT',
  OPEN_FILE_PICKER = 'OPEN_FILE_PICKER',
  OPEN_TRUSTED_LINK = 'OPEN_TRUSTED_LINK',
  RENAME_ACTIVE_CONNECTION = 'RENAME_ACTIVE_CONNECTION',
  THEME_CHANGED = 'THEME_CHANGED',
}

interface BasicWebviewMessage {
  command: string;
}

export interface CreateNewPlaygroundMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CREATE_NEW_PLAYGROUND;
}

export interface ConnectionStatusMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE;
  connectionStatus: CONNECTION_STATUS;
  activeConnectionName: string;
}

export interface ConnectMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECT;
  connectionInfo: ConnectionInfo;
  connectionAttemptId: string;
}

export interface CancelConnectMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CANCEL_CONNECT;
}

// TODO: VSCODE-491 - Remove this entirely when getting rid of legacy
export interface LegacyConnectMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.LEGACY_CONNECT;
  connectionModel: LegacyConnectionModel;
  connectionAttemptId: string;
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

export interface ThemeChangedMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.THEME_CHANGED;
  darkMode: boolean;
}

export type MESSAGE_FROM_WEBVIEW_TO_EXTENSION =
  | ConnectMessage
  | CancelConnectMessage
  | LegacyConnectMessage
  | CreateNewPlaygroundMessage
  | GetConnectionStatusMessage
  | LinkClickedMessage
  | OpenConnectionStringInputMessage
  | OpenFilePickerMessage
  | OpenTrustedLinkMessage
  | RenameConnectionMessage;

export type MESSAGE_FROM_EXTENSION_TO_WEBVIEW =
  | ConnectResultsMessage
  | FilePickerResultsMessage
  | ConnectionStatusMessage
  | ThemeChangedMessage;
