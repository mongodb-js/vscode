import {
  PreviewMessageType,
  type MessageFromWebviewToExtension,
} from './extension-app-message-constants';

interface VSCodeApi {
  postMessage: (message: MessageFromWebviewToExtension) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;

let vscode: VSCodeApi | undefined;

export const getVSCodeApi = (): VSCodeApi => {
  if (!vscode) {
    vscode = acquireVsCodeApi();
  }
  return vscode;
};

export const sendGetDocuments = (): void => {
  getVSCodeApi().postMessage({
    command: PreviewMessageType.getDocuments,
  });
};

export const sendRefreshDocuments = (): void => {
  getVSCodeApi().postMessage({
    command: PreviewMessageType.refreshDocuments,
  });
};

export const sendFetchPage = (skip: number, limit: number): void => {
  getVSCodeApi().postMessage({
    command: PreviewMessageType.fetchPage,
    skip,
    limit,
  });
};
