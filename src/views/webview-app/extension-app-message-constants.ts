import type { ConnectionOptions } from 'mongodb-data-service';
import type { Uri } from 'vscode';

export enum CONNECTION_STATUS {
  LOADING = 'LOADING', // When the connection status has not yet been shared from the extension.
  CONNECTED = 'CONNECTED',
  CONNECTING = 'CONNECTING',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED',
}

export const VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID =
  'VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID';

export const VSCODE_EXTENSION_OIDC_DEVICE_AUTH_ID =
  'VSCODE_EXTENSION_OIDC_DEVICE_AUTH_ID';

export enum MESSAGE_TYPES {
  CONNECT = 'CONNECT',
  CANCEL_CONNECT = 'CANCEL_CONNECT',
  CONNECT_RESULT = 'CONNECT_RESULT',
  CONNECTION_FORM_OPENED = 'CONNECTION_FORM_OPENED',
  OPEN_FILE_CHOOSER = 'OPEN_FILE_CHOOSER',
  OPEN_FILE_CHOOSER_RESULT = 'OPEN_FILE_CHOOSER_RESULT',
  CONNECTION_STATUS_MESSAGE = 'CONNECTION_STATUS_MESSAGE',
  OPEN_EDIT_CONNECTION = 'OPEN_EDIT_CONNECTION',
  EDIT_AND_CONNECT_CONNECTION = 'EDIT_AND_CONNECT_CONNECTION',
  EXTENSION_LINK_CLICKED = 'EXTENSION_LINK_CLICKED',
  CREATE_NEW_PLAYGROUND = 'CREATE_NEW_PLAYGROUND',
  GET_CONNECTION_STATUS = 'GET_CONNECTION_STATUS',
  OPEN_CONNECTION_STRING_INPUT = 'OPEN_CONNECTION_STRING_INPUT',
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

export interface ConnectionFormOpenedMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECTION_FORM_OPENED;
}

export interface ConnectionStatusMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE;
  connectionStatus: CONNECTION_STATUS;
  activeConnectionName: string;
}

export interface OpenEditConnectionMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.OPEN_EDIT_CONNECTION;
  connection: {
    id: string;
    name: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface EditAndConnectConnection extends BasicWebviewMessage {
  command: MESSAGE_TYPES.EDIT_AND_CONNECT_CONNECTION;
  connectionInfo: {
    id: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface OpenFileChooser extends BasicWebviewMessage {
  command: MESSAGE_TYPES.OPEN_FILE_CHOOSER;
  requestId: string;
}

export interface ConnectMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECT;
  connectionInfo: {
    id: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface CancelConnectMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CANCEL_CONNECT;
}

export interface ConnectResultsMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECT_RESULT;
  connectionSuccess: boolean;
  connectionMessage: string;
  connectionId: string;
}

export interface OpenFileChooserResultMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.OPEN_FILE_CHOOSER_RESULT;
  files: Uri | Uri[] | undefined;
  requestId: string;
}

export interface GetConnectionStatusMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.GET_CONNECTION_STATUS;
}

export interface OpenConnectionStringInputMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT;
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
  | ConnectionFormOpenedMessage
  | CreateNewPlaygroundMessage
  | GetConnectionStatusMessage
  | LinkClickedMessage
  | OpenConnectionStringInputMessage
  | OpenTrustedLinkMessage
  | RenameConnectionMessage
  | EditAndConnectConnection
  | OpenFileChooser;

export type MESSAGE_FROM_EXTENSION_TO_WEBVIEW =
  | ConnectResultsMessage
  | ConnectionStatusMessage
  | ThemeChangedMessage
  | OpenEditConnectionMessage
  | OpenFileChooserResultMessage;
