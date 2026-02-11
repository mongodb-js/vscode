export const PreviewMessageType = {
  // Messages from webview to extension
  getDocuments: 'GET_DOCUMENTS',
  getTotalCount: 'GET_TOTAL_COUNT',
  cancelRequest: 'CANCEL_REQUEST',
  getThemeColors: 'GET_THEME_COLORS',
  editDocument: 'EDIT_DOCUMENT',
  cloneDocument: 'CLONE_DOCUMENT',
  deleteDocument: 'DELETE_DOCUMENT',

  // Messages from extension to webview
  loadPage: 'LOAD_PAGE',
  getDocumentError: 'DOCUMENT_GET_ERROR',
  requestCancelled: 'REQUEST_CANCELLED',
  updateTotalCount: 'UPDATE_TOTAL_COUNT',
  updateTotalCountError: 'UPDATE_TOTAL_COUNT_ERROR',
  updateThemeColors: 'UPDATE_THEME_COLORS',
  documentDeleted: 'DOCUMENT_DELETED',
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

export type DocumentSort = Record<string, 1 | -1>;

export const SORT_VALUE_MAP = {
  default: undefined,
  _id_asc: { _id: 1 } as DocumentSort,
  _id_desc: { _id: -1 } as DocumentSort,
} as const;

export type SortValueKey = keyof typeof SORT_VALUE_MAP;

export interface GetDocumentsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.getDocuments;
  skip: number;
  limit: number;
  sort?: DocumentSort;
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

export interface EditDocumentMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.editDocument;
  documentId: any;
}

export interface CloneDocumentMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.cloneDocument;
  document: Record<string, unknown>;
}

export interface DeleteDocumentMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.deleteDocument;
  documentId: any;
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

export interface DocumentDeletedMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.documentDeleted;
}

export type MessageFromWebviewToExtension =
  | GetDocumentsMessage
  | GetTotalCountMessage
  | CancelRequestMessage
  | GetThemeColorsMessage
  | EditDocumentMessage
  | CloneDocumentMessage
  | DeleteDocumentMessage;

export type MessageFromExtensionToWebview =
  | LoadPageMessage
  | DocumentGetErrorMessage
  | RequestCancelledMessage
  | UpdateTotalCountMessage
  | UpdateTotalCountErrorMessage
  | UpdateThemeColorsMessage
  | DocumentDeletedMessage;
