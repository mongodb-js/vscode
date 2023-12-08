import type { ConnectionInfo } from 'mongodb-data-service-legacy';
import {
  MESSAGE_TYPES,
  type MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
} from './extension-app-message-constants';

interface VSCodeApi {
  postMessage: (message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;
const vscode = acquireVsCodeApi();

export const sendConnectToExtension = (
  connectionInfo: ConnectionInfo,
  connectionAttemptId: string
) => {
  vscode.postMessage({
    command: MESSAGE_TYPES.CONNECT,
    connectionInfo,
    connectionAttemptId,
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
