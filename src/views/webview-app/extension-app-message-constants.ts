import LegacyConnectionModel from './connection-model/legacy-connection-model';
import { FilePickerActionTypes } from './store/actions';
import type { FileDirectory } from '../../ai-code/constants';

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
  OPEN_TRUSTED_LINK = 'OPEN_TRUSTED_LINK',
  RENAME_ACTIVE_CONNECTION = 'RENAME_ACTIVE_CONNECTION',

  // AI Code events.
  LOAD_CODEBASE = 'LOAD_CODEBASE',
  CODEBASE_LOADED = 'CODEBASE_LOADED',
  LOAD_SUGGESTIONS = 'LOAD_SUGGESTIONS',
  SUGGESTIONS_LOADED = 'SUGGESTIONS_LOADED',

  ASK_QUESTION = 'ASK_QUESTION',
  QUESTION_RESPONSE = 'QUESTION_RESPONSE',
}

interface BasicWebviewMessage {
  command: string;
}

export interface AskQuestionMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.ASK_QUESTION;
  id: string;

  text: string;
  selection?: string;
}
export interface QuestionResponseMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.QUESTION_RESPONSE;
  id: string;
  error?: string;

  text: string;
}
export interface LoadCodebaseMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.LOAD_CODEBASE;
  id: string;

  // githubLink: string;
  // useGithubLink: boolean;
}
export interface CodebaseLoadedMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.CODEBASE_LOADED;
  id: string;
  error?: string;

  fileCount: number;
  fileStructure: FileDirectory;
  workingDirectory: string;
}
export interface LoadSuggestionsMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.LOAD_SUGGESTIONS;
  id: string;

  workingDirectory: string;
  promptText: string;
  useChatbot: boolean;
  fileStructure: FileDirectory;
}
export interface SuggestionsLoadedMessage extends BasicWebviewMessage {
  command: MESSAGE_TYPES.SUGGESTIONS_LOADED;
  id: string;
  error?: string;

  diffResult: string;
  descriptionOfChanges: string;
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

export type MESSAGE_FROM_WEBVIEW_TO_EXTENSION =
  | ConnectMessage
  | CreateNewPlaygroundMessage
  | GetConnectionStatusMessage
  | LinkClickedMessage
  | OpenConnectionStringInputMessage
  | OpenFilePickerMessage
  | OpenTrustedLinkMessage
  | RenameConnectionMessage
  | AskQuestionMessage
  | LoadCodebaseMessage
  | LoadSuggestionsMessage;

export type MESSAGE_FROM_EXTENSION_TO_WEBVIEW =
  | ConnectResultsMessage
  | FilePickerResultsMessage
  | ConnectionStatusMessage
  | QuestionResponseMessage
  | SuggestionsLoadedMessage
  | CodebaseLoadedMessage;
