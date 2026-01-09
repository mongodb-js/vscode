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
const vscode = acquireVsCodeApi();

export const sendGetDocuments = (): void => {
  vscode.postMessage({
    command: PreviewMessageType.getDocuments,
  });
};

export default vscode;
