import {
  MESSAGE_TYPES,
  type MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
  type ConnectMessage,
} from './extension-app-message-constants';

interface VSCodeApi {
  postMessage: (message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;
const vscode = acquireVsCodeApi();

export const sendEditConnectionToExtension = (
  connectionInfo: ConnectMessage['connectionInfo']
) => {
  vscode.postMessage({
    command: MESSAGE_TYPES.EDIT_AND_CONNECT_CONNECTION,
    connectionInfo,
  });
};

export const sendConnectToExtension = (
  connectionInfo: ConnectMessage['connectionInfo']
) => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CONNECT,
    connectionInfo,
  });
};

export const sendCancelConnectToExtension = () => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CANCEL_CONNECT,
  });
};

// When the form is opened we want to close the connection string
// input if it's open, so we message the extension.
export const sendFormOpenedToExtension = () => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CONNECTION_FORM_OPENED,
  });
};

export const renameActiveConnection = () => {
  vscode.postMessage({
    command: MESSAGE_TYPES.RENAME_ACTIVE_CONNECTION,
  });
};

export const createNewPlayground = () => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CREATE_NEW_PLAYGROUND,
  });
};

export const connectWithConnectionString = () => {
  vscode.postMessage({
    command: MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT,
  });
};

export const trackExtensionLinkClicked = (screen: string, linkId: string) => {
  vscode.postMessage({
    command: MESSAGE_TYPES.EXTENSION_LINK_CLICKED,
    screen,
    linkId,
  });
};

export const openTrustedLink = (linkTo: string) => {
  vscode.postMessage({
    command: MESSAGE_TYPES.OPEN_TRUSTED_LINK,
    linkTo,
  });
};

export default vscode;
