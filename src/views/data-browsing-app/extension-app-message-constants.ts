export const PreviewMessageType = {
  // Messages from webview to extension
  getDocuments: 'GET_DOCUMENTS',
  refreshDocuments: 'REFRESH_DOCUMENTS',
  fetchPage: 'FETCH_PAGE',
  cancelRequest: 'CANCEL_REQUEST',

  // Messages from extension to webview
  loadDocuments: 'LOAD_DOCUMENTS',
  loadPage: 'LOAD_PAGE',
  refreshError: 'REFRESH_ERROR',
  requestCancelled: 'REQUEST_CANCELLED',
  updateTotalCount: 'UPDATE_TOTAL_COUNT',
  updateTotalCountError: 'UPDATE_TOTAL_COUNT_ERROR',
} as const;

export type PreviewMessageType =
  (typeof PreviewMessageType)[keyof typeof PreviewMessageType];

// Messages from webview to extension
interface BasicWebviewMessage {
  command: string;
}

export interface GetDocumentsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.getDocuments;
}

export interface RefreshDocumentsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.refreshDocuments;
}

export interface FetchPageMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.fetchPage;
  skip: number;
  limit: number;
}

export interface CancelRequestMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.cancelRequest;
}

// Messages from extension to webview
export interface LoadDocumentsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.loadDocuments;
  documents: Record<string, unknown>[];
  totalCount?: number | null;
}

export interface RefreshErrorMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.refreshError;
  error?: string;
}

export interface LoadPageMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.loadPage;
  documents: Record<string, unknown>[];
  skip: number;
  limit: number;
}

export interface RequestCancelledMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.requestCancelled;
}

export interface UpdateTotalCountMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.updateTotalCount;
  totalCount: number | null;
}

export interface UpdateTotalCountErrorMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.updateTotalCountError;
  error?: string;
}

export type MessageFromWebviewToExtension =
  | GetDocumentsMessage
  | RefreshDocumentsMessage
  | FetchPageMessage
  | CancelRequestMessage;

export type MessageFromExtensionToWebview =
  | LoadDocumentsMessage
  | LoadPageMessage
  | RefreshErrorMessage
  | RequestCancelledMessage
  | UpdateTotalCountMessage
  | UpdateTotalCountErrorMessage;
