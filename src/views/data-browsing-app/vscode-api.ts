import {
  PreviewMessageType,
  type MessageFromWebviewToExtension,
} from './extension-app-message-constants';
import type { SortOption } from './store/documentQuerySlice';

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

export const sendGetDocuments = ({
  skip,
  limit,
  sort,
}: {
  skip: number;
  limit: number;
  sort?: SortOption | null;
}): void => {
  getVSCodeApi().postMessage({
    command: PreviewMessageType.getDocuments,
    skip,
    limit,
    ...(sort?.sort ? { sort: sort.sort } : {}),
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

export const sendGetThemeColors = (): void => {
  getVSCodeApi().postMessage({
    command: PreviewMessageType.getThemeColors,
  });
};
