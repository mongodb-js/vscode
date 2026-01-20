export const PreviewMessageType = {
  // Messages from webview to extension
  getDocuments: 'GET_DOCUMENTS',
  refreshDocuments: 'REFRESH_DOCUMENTS',

  // Messages from extension to webview
  loadDocuments: 'LOAD_DOCUMENTS',
  refreshError: 'REFRESH_ERROR',
  themeChanged: 'THEME_CHANGED',
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

// Theme colors for JSON syntax highlighting
export interface JsonTokenColors {
  key: string;
  string: string;
  number: string;
  boolean: string;
  null: string;
  type: string;
  comment: string;
  punctuation: string;
}

export interface ThemeChangedMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.themeChanged;
  colors: JsonTokenColors;
}

export type MessageFromWebviewToExtension =
  | GetDocumentsMessage
  | RefreshDocumentsMessage;

export type MessageFromExtensionToWebview =
  | LoadDocumentsMessage
  | RefreshErrorMessage
  | ThemeChangedMessage;
