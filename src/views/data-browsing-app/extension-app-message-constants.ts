export const PreviewMessageType = {
  // Messages from webview to extension
  getDocuments: 'GET_DOCUMENTS',
  refreshDocuments: 'REFRESH_DOCUMENTS',
  sortDocuments: 'SORT_DOCUMENTS',

  // Messages from extension to webview
  loadDocuments: 'LOAD_DOCUMENTS',
  refreshError: 'REFRESH_ERROR',
} as const;

export type PreviewMessageType =
  (typeof PreviewMessageType)[keyof typeof PreviewMessageType];

export type SortOption = 'default' | 'asc' | 'desc';

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

export interface SortDocumentsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.sortDocuments;
  sortOption: SortOption;
}

// Messages from extension to webview
export interface LoadDocumentsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.loadDocuments;
  documents: Record<string, unknown>[];
  totalCount?: number;
}

export interface RefreshErrorMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.refreshError;
  error?: string;
}

export type MessageFromWebviewToExtension =
  | GetDocumentsMessage
  | RefreshDocumentsMessage
  | SortDocumentsMessage;

export type MessageFromExtensionToWebview =
  | LoadDocumentsMessage
  | RefreshErrorMessage;
