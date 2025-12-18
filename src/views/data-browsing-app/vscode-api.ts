import {
  PreviewMessageType,
  type MessageFromWebviewToExtension,
  type SortOption,
} from './extension-app-message-constants';

interface VSCodeApi {
  postMessage: (message: MessageFromWebviewToExtension) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;
const vscode = acquireVsCodeApi();

export const sendGetDocuments = (): void => {
  vscode.postMessage({
    command: PreviewMessageType.getDocuments,
  });
};

export const sendRefreshDocuments = (): void => {
  vscode.postMessage({
    command: PreviewMessageType.refreshDocuments,
  });
};

export const sendSortDocuments = (sort: SortOption): void => {
  vscode.postMessage({
    command: PreviewMessageType.sortDocuments,
    sort,
  });
};

export default vscode;

