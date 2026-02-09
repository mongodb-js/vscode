export const PreviewMessageType = {
  // Messages from webview to extension
  getDocuments: 'GET_DOCUMENTS',
  getTotalCount: 'GET_TOTAL_COUNT',
  cancelRequest: 'CANCEL_REQUEST',
  getThemeColors: 'GET_THEME_COLORS',

  // Messages from extension to webview
  loadPage: 'LOAD_PAGE',
  getDocumentError: 'DOCUMENT_GET_ERROR',
  requestCancelled: 'REQUEST_CANCELLED',
  updateTotalCount: 'UPDATE_TOTAL_COUNT',
  updateTotalCountError: 'UPDATE_TOTAL_COUNT_ERROR',
  updateThemeColors: 'UPDATE_THEME_COLORS',
} as const;

export interface TokenColors {
  key?: string;
  string?: string;
  number?: string;
  boolean?: string;
  null?: string;
  type?: string;
  comment?: string;
  punctuation?: string;
}

export type MonacoBaseTheme = 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';

export type PreviewMessageType =
  (typeof PreviewMessageType)[keyof typeof PreviewMessageType];

// Messages from webview to extension
interface BasicWebviewMessage {
  command: string;
}

export interface GetDocumentsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.getDocuments;
  skip: number;
  limit: number;
}

export interface CancelRequestMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.cancelRequest;
}

export interface GetTotalCountMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.getTotalCount;
}

export interface GetThemeColorsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.getThemeColors;
}

// Messages from extension to webview
export interface LoadPageMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.loadPage;
  documents: Record<string, unknown>[];
}

export interface DocumentGetErrorMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.getDocumentError;
  error?: string;
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

export interface UpdateThemeColorsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.updateThemeColors;
  themeColors: TokenColors | null;
  themeKind: MonacoBaseTheme;
}

export type MessageFromWebviewToExtension =
  | GetDocumentsMessage
  | GetTotalCountMessage
  | CancelRequestMessage
  | GetThemeColorsMessage;

export type MessageFromExtensionToWebview =
  | LoadPageMessage
  | DocumentGetErrorMessage
  | RequestCancelledMessage
  | UpdateTotalCountMessage
  | UpdateTotalCountErrorMessage
  | UpdateThemeColorsMessage;
