import type { ConnectionOptions } from 'mongodb-data-service';
import type { FileChooserOptions } from './use-connection-form';

export const CONNECTION_STATUS = {
  LOADING: 'LOADING', // When the connection status has not yet been shared from the extension.
  CONNECTED: 'CONNECTED',
  CONNECTING: 'CONNECTING',
  DISCONNECTING: 'DISCONNECTING',
  DISCONNECTED: 'DISCONNECTED',
} as const;

export type ConnectionStatus =
  (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS];

export const VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID =
  'VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID';

export const VSCODE_EXTENSION_OIDC_DEVICE_AUTH_ID =
  'VSCODE_EXTENSION_OIDC_DEVICE_AUTH_ID';

export const MESSAGE_TYPES = {
  CONNECT: 'CONNECT',
  CANCEL_CONNECT: 'CANCEL_CONNECT',
  CONNECT_RESULT: 'CONNECT_RESULT',
  CONNECTION_FORM_OPENED: 'CONNECTION_FORM_OPENED',
  OPEN_FILE_CHOOSER: 'OPEN_FILE_CHOOSER',
  OPEN_FILE_CHOOSER_RESULT: 'OPEN_FILE_CHOOSER_RESULT',
  CONNECTION_STATUS_MESSAGE: 'CONNECTION_STATUS_MESSAGE',
  OPEN_EDIT_CONNECTION: 'OPEN_EDIT_CONNECTION',
  EDIT_CONNECTION_AND_CONNECT: 'EDIT_CONNECTION_AND_CONNECT',
  EXTENSION_LINK_CLICKED: 'EXTENSION_LINK_CLICKED',
  CREATE_NEW_PLAYGROUND: 'CREATE_NEW_PLAYGROUND',
  GET_CONNECTION_STATUS: 'GET_CONNECTION_STATUS',
  OPEN_CONNECTION_STRING_INPUT: 'OPEN_CONNECTION_STRING_INPUT',
  OPEN_TRUSTED_LINK: 'OPEN_TRUSTED_LINK',
  RENAME_ACTIVE_CONNECTION: 'RENAME_ACTIVE_CONNECTION',
  THEME_CHANGED: 'THEME_CHANGED',
} as const;

interface BasicWebviewMessage {
  command: string;
}

export interface CreateNewPlaygroundMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.CREATE_NEW_PLAYGROUND;
}

export interface ConnectionFormOpenedMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.CONNECTION_FORM_OPENED;
}

export interface ConnectionStatusMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE;
  connectionStatus: ConnectionStatus;
  activeConnectionName: string;
}

export interface OpenEditConnectionMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.OPEN_EDIT_CONNECTION;
  connection: {
    id: string;
    name: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface EditConnectionAndConnectMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.EDIT_CONNECTION_AND_CONNECT;
  connectionInfo: {
    id: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface OpenFileChooserMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.OPEN_FILE_CHOOSER;
  fileChooserOptions: FileChooserOptions;
  requestId: string;
}

export interface ConnectMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.CONNECT;
  connectionInfo: {
    id: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface CancelConnectMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.CANCEL_CONNECT;
}

export interface ConnectResultsMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.CONNECT_RESULT;
  connectionSuccess: boolean;
  connectionMessage: string;
  connectionId: string;
}

export type FileChooserResult =
  | { canceled: false; filePaths: string[] }
  | { canceled: false; filePath?: string };

export interface OpenFileChooserResultMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.OPEN_FILE_CHOOSER_RESULT;
  fileChooserResult: FileChooserResult;
  requestId: string;
}

export interface GetConnectionStatusMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.GET_CONNECTION_STATUS;
}

export interface OpenConnectionStringInputMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT;
}

export interface LinkClickedMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.EXTENSION_LINK_CLICKED;
  screen: string;
  linkId: string;
}

export interface OpenTrustedLinkMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.OPEN_TRUSTED_LINK;
  linkTo: string;
}

export interface RenameConnectionMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.RENAME_ACTIVE_CONNECTION;
}

export interface ThemeChangedMessage extends BasicWebviewMessage {
  command: typeof MESSAGE_TYPES.THEME_CHANGED;
  darkMode: boolean;
}

export type MessageFromWebviewToExtension =
  | ConnectMessage
  | CancelConnectMessage
  | ConnectionFormOpenedMessage
  | CreateNewPlaygroundMessage
  | GetConnectionStatusMessage
  | LinkClickedMessage
  | OpenConnectionStringInputMessage
  | OpenTrustedLinkMessage
  | RenameConnectionMessage
  | EditConnectionAndConnectMessage
  | OpenFileChooserMessage;

export type MessageFromExtensionToWebview =
  | ConnectResultsMessage
  | ConnectionStatusMessage
  | ThemeChangedMessage
  | OpenEditConnectionMessage
  | OpenFileChooserResultMessage;
