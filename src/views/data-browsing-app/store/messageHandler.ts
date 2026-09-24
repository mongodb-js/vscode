import type { MessageFromExtensionToWebview } from '../extension-app-message-constants';
import {
  PreviewMessageType,
  isMessageFromExtension,
} from '../extension-app-message-constants';
import type { AppDispatch } from './index';
import type { PreviewDocument } from './documentQuerySlice';
import {
  documentsReceived,
  documentsFetchFailed,
  requestCancelled,
  totalCountReceived,
  totalCountFetchFailed,
  themeColorsReceived,
  documentsRefreshRequested,
} from './documentQuerySlice';

export const handleExtensionMessage = (
  dispatch: AppDispatch,
  message: MessageFromExtensionToWebview,
): void => {
  switch (message.command) {
    case PreviewMessageType.loadPage:
      dispatch(documentsReceived(message.documents as PreviewDocument[]));
      break;
    case PreviewMessageType.getDocumentError: {
      const errorMessage = message.error || 'Failed to fetch documents';
      dispatch(documentsFetchFailed(errorMessage));
      break;
    }
    case PreviewMessageType.requestCancelled:
      dispatch(requestCancelled());
      break;
    case PreviewMessageType.updateTotalCount:
      dispatch(totalCountReceived(message.totalCount));
      break;
    case PreviewMessageType.updateTotalCountError: {
      const errorMessage = message.error || 'Failed to fetch total count';
      dispatch(totalCountFetchFailed(errorMessage));
      break;
    }
    case PreviewMessageType.updateThemeColors:
      dispatch(
        themeColorsReceived({
          themeColors: message.themeColors,
          themeKind: message.themeKind,
        }),
      );
      break;
    case PreviewMessageType.documentDeleted:
      // Refresh the documents after a delete
      dispatch(documentsRefreshRequested());
      break;
  }
};

/**
 * Each panel gets its own unguessable `vscode-webview://<uuid>` origin, which
 * is the origin VS Code posts extension messages from.
 *
 * Checking `event.source === window.parent` instead rejects every real message:
 * this frame is sandboxed, so `window.parent` is the frame itself while real
 * messages carry the unreachable host frame as their source.
 */
const isFromExtensionHost = (event: MessageEvent): boolean =>
  event.origin === window.location.origin;

export const setupMessageHandler = (dispatch: AppDispatch): (() => void) => {
  const handleMessage = (event: MessageEvent): void => {
    if (!isFromExtensionHost(event) || !isMessageFromExtension(event.data)) {
      return;
    }

    handleExtensionMessage(dispatch, event.data);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
  };
};
