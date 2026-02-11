import type { ConnectionOptions } from 'mongodb-data-service';
import type { FileChooserOptions } from './use-connection-form';

export const CONNECTION_STATUS = {
  loading: 'LOADING', // When the connection status has not yet been shared from the extension.
  connected: 'CONNECTED',
  connecting: 'CONNECTING',
  disconnecting: 'DISCONNECTING',
  disconnected: 'DISCONNECTED',
} as const;

export type ConnectionStatus =
  (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS];

export interface WebviewVscodeOptions {
  segmentAnonymousId?: string;
  showOidcDeviceAuthFlow?: boolean;
}

declare global {
  interface Window {
    MDB_WEBVIEW_OPTIONS?: WebviewVscodeOptions;
  }
}

export const MessageType = {
  connect: 'CONNECT',
  cancelConnect: 'CANCEL_CONNECT',
  connectResult: 'CONNECT_RESULT',
  connectionFormOpened: 'CONNECTION_FORM_OPENED',
  openFileChooser: 'OPEN_FILE_CHOOSER',
  openFileChooserResult: 'OPEN_FILE_CHOOSER_RESULT',
  connectionStatusMessage: 'CONNECTION_STATUS_MESSAGE',
  openEditConnection: 'OPEN_EDIT_CONNECTION',
  editConnectionAndConnect: 'EDIT_CONNECTION_AND_CONNECT',
  extensionLinkClicked: 'EXTENSION_LINK_CLICKED',
  createNewPlayground: 'CREATE_NEW_PLAYGROUND',
  getConnectionStatus: 'GET_CONNECTION_STATUS',
  openConnectionStringInput: 'OPEN_CONNECTION_STRING_INPUT',
  openTrustedLink: 'OPEN_TRUSTED_LINK',
  renameActiveConnection: 'RENAME_ACTIVE_CONNECTION',
  themeChanged: 'THEME_CHANGED',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

interface BasicWebviewMessage {
  command: string;
}

export interface CreateNewPlaygroundMessage extends BasicWebviewMessage {
  command: typeof MessageType.createNewPlayground;
}

export interface ConnectionFormOpenedMessage extends BasicWebviewMessage {
  command: typeof MessageType.connectionFormOpened;
}

export interface ConnectionStatusMessage extends BasicWebviewMessage {
  command: typeof MessageType.connectionStatusMessage;
  connectionStatus: ConnectionStatus;
  activeConnectionName: string;
}

export interface OpenEditConnectionMessage extends BasicWebviewMessage {
  command: typeof MessageType.openEditConnection;
  connection: {
    id: string;
    name: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface EditConnectionAndConnectMessage extends BasicWebviewMessage {
  command: typeof MessageType.editConnectionAndConnect;
  connectionInfo: {
    id: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface OpenFileChooserMessage extends BasicWebviewMessage {
  command: typeof MessageType.openFileChooser;
  fileChooserOptions: FileChooserOptions;
  requestId: string;
}

export interface ConnectMessage extends BasicWebviewMessage {
  command: typeof MessageType.connect;
  connectionInfo: {
    id: string;
    connectionOptions: ConnectionOptions;
  };
}

export interface CancelConnectMessage extends BasicWebviewMessage {
  command: typeof MessageType.cancelConnect;
}

export interface ConnectResultsMessage extends BasicWebviewMessage {
  command: typeof MessageType.connectResult;
  connectionSuccess: boolean;
  connectionMessage: string;
  connectionId: string;
}

export type FileChooserResult =
  | { canceled: false; filePaths: string[] }
  | { canceled: false; filePath?: string };

export interface OpenFileChooserResultMessage extends BasicWebviewMessage {
  command: typeof MessageType.openFileChooserResult;
  fileChooserResult: FileChooserResult;
  requestId: string;
}

export interface GetConnectionStatusMessage extends BasicWebviewMessage {
  command: typeof MessageType.getConnectionStatus;
}

export interface OpenConnectionStringInputMessage extends BasicWebviewMessage {
  command: typeof MessageType.openConnectionStringInput;
}

export interface LinkClickedMessage extends BasicWebviewMessage {
  command: typeof MessageType.extensionLinkClicked;
  screen: string;
  linkId: string;
}

export interface OpenTrustedLinkMessage extends BasicWebviewMessage {
  command: typeof MessageType.openTrustedLink;
  linkTo: string;
}

export interface RenameConnectionMessage extends BasicWebviewMessage {
  command: typeof MessageType.renameActiveConnection;
}

export interface ThemeChangedMessage extends BasicWebviewMessage {
  command: typeof MessageType.themeChanged;
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
