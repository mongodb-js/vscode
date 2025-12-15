import {
  MessageType,
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
  connectionInfo: ConnectMessage['connectionInfo'],
): void => {
  vscode.postMessage({
    command: MessageType.editConnectionAndConnect,
    connectionInfo,
  });
};

export const sendConnectToExtension = (
  connectionInfo: ConnectMessage['connectionInfo'],
): void => {
  vscode.postMessage({
    command: MessageType.connect,
    connectionInfo,
  });
};

export const sendOpenFileChooserToExtension = (
  fileChooserOptions: FileChooserOptions,
  requestId: string,
): void => {
  vscode.postMessage({
    command: MessageType.openFileChooser,
    fileChooserOptions,
    requestId,
  });
};

export const sendCancelConnectToExtension = (): void => {
  vscode.postMessage({
    command: MessageType.cancelConnect,
  });
};

// When the form is opened we want to close the connection string
// input if it's open, so we message the extension.
export const sendFormOpenedToExtension = (): void => {
  vscode.postMessage({
    command: MessageType.connectionFormOpened,
  });
};

export const renameActiveConnection = (): void => {
  vscode.postMessage({
    command: MessageType.renameActiveConnection,
  });
};

export const createNewPlayground = (): void => {
  vscode.postMessage({
    command: MessageType.createNewPlayground,
  });
};

export const connectWithConnectionString = (): void => {
  vscode.postMessage({
    command: MessageType.openConnectionStringInput,
  });
};

export const trackExtensionLinkClicked = (
  screen: string,
  linkId: string,
): void => {
  vscode.postMessage({
    command: MessageType.extensionLinkClicked,
    screen,
    linkId,
  });
};

export const openTrustedLink = (linkTo: string): void => {
  vscode.postMessage({
    command: MessageType.openTrustedLink,
    linkTo,
  });
};

export default vscode;
