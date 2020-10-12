import { FilePickerActionTypes } from './store/actions';

export enum CONNECTION_STATUS {
  CONNECTED = 'CONNECTED',
  CONNECTING = 'CONNECTING',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED'
}

export enum WEBVIEW_VIEWS {
  CONNECT = 'CONNECT',
  OVERVIEW = 'OVERVIEW'
}

export const INITIAL_WEBVIEW_VIEW_GLOBAL_VARNAME = '@@@WEBVIEW_INITIAL_VIEW@@@';

export enum MESSAGE_TYPES {
  CONNECT = 'CONNECT',
  CONNECT_RESULT = 'CONNECT_RESULT',
  CONNECTION_STATUS_MESSAGE = 'CONNECTION_STATUS_MESSAGE',
  CREATE_NEW_PLAYGROUND = 'CREATE_NEW_PLAYGROUND',
  GET_CONNECTION_STATUS = 'GET_CONNECTION_STATUS',
  OPEN_CONNECTION_STRING_INPUT = 'OPEN_CONNECTION_STRING_INPUT',
  OPEN_FILE_PICKER = 'OPEN_FILE_PICKER',
  FILE_PICKER_RESULTS = 'FILE_PICKER_RESULTS',
  EXTENSION_LINK_CLICKED = 'EXTENSION_LINK_CLICKED'
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
  connectionModel: any;
}

export interface ConnectResultsMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CONNECT_RESULT;
  connectionSuccess: boolean;
  connectionMessage: string;
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

export type MESSAGE_FROM_WEBVIEW_TO_EXTENSION =
  | ConnectMessage
  | CreateNewPlaygroundMessage
  | GetConnectionStatusMessage
  | LinkClickedMessage
  | OpenConnectionStringInputMessage
  | OpenFilePickerMessage;

export type MESSAGE_FROM_EXTENSION_TO_WEBVIEW =
  | ConnectResultsMessage
  | FilePickerResultsMessage
  | ConnectionStatusMessage;
