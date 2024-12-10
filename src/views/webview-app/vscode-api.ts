import {
  MESSAGE_TYPES,
  type MessageFromWebviewToExtension,
  type ConnectMessage,
} from './extension-app-message-constants';
import type { FileChooserOptions } from './use-connection-form';

interface VSCodeApi {
  postMessage: (message: MessageFromWebviewToExtension) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;
const vscode = acquireVsCodeApi();

export const sendEditConnectionToExtension = (
  connectionInfo: ConnectMessage['connectionInfo']
): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.EDIT_CONNECTION_AND_CONNECT,
    connectionInfo,
  });
};

export const sendConnectToExtension = (
  connectionInfo: ConnectMessage['connectionInfo']
): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CONNECT,
    connectionInfo,
  });
};

export const sendOpenFileChooserToExtension = (
  fileChooserOptions: FileChooserOptions,
  requestId: string
): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.OPEN_FILE_CHOOSER,
    fileChooserOptions,
    requestId,
  });
};

export const sendCancelConnectToExtension = (): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CANCEL_CONNECT,
  });
};

// When the form is opened we want to close the connection string
// input if it's open, so we message the extension.
export const sendFormOpenedToExtension = (): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CONNECTION_FORM_OPENED,
  });
};

export const renameActiveConnection = (): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.RENAME_ACTIVE_CONNECTION,
  });
};

export const createNewPlayground = (): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CREATE_NEW_PLAYGROUND,
  });
};

export const connectWithConnectionString = (): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT,
  });
};

export const trackExtensionLinkClicked = (
  screen: string,
  linkId: string
): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.EXTENSION_LINK_CLICKED,
    screen,
    linkId,
  });
};

export const openTrustedLink = (linkTo: string): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.OPEN_TRUSTED_LINK,
    linkTo,
  });
};

export default vscode;
