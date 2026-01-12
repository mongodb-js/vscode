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

const getVSCodeApi = (): VSCodeApi => {
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

export default getVSCodeApi;
