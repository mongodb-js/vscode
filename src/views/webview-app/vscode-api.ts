import type { MESSAGE_FROM_WEBVIEW_TO_EXTENSION } from './extension-app-message-constants';

interface VSCodeApi {
  postMessage: (message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;
export const vscode = acquireVsCodeApi();
