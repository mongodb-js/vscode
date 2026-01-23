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

export const sendGetDocuments = (skip: number, limit: number): void => {
  getVSCodeApi().postMessage({
    command: PreviewMessageType.getDocuments,
    skip,
    limit,
  });
};

export const sendGetTotalCount = (): void => {
  getVSCodeApi().postMessage({
    command: PreviewMessageType.getTotalCount,
  });
};

export const sendCancelRequest = (): void => {
  getVSCodeApi().postMessage({
    command: PreviewMessageType.cancelRequest,
  });
};
