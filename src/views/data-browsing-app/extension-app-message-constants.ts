export const PreviewMessageType = {
  // Messages from webview to extension
  getDocuments: 'GET_DOCUMENTS',

  // Messages from extension to webview
  loadDocuments: 'LOAD_DOCUMENTS',
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

// Messages from extension to webview
export interface LoadDocumentsMessage extends BasicWebviewMessage {
  command: typeof PreviewMessageType.loadDocuments;
  documents: Record<string, unknown>[];
  totalCount?: number;
}

export type MessageFromWebviewToExtension = GetDocumentsMessage;

export type MessageFromExtensionToWebview = LoadDocumentsMessage;
