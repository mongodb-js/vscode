import type { MessageFromExtensionToWebview } from '../extension-app-message-constants';
import { PreviewMessageType } from '../extension-app-message-constants';
import type { AppDispatch } from './index';
import type { PreviewDocument } from './documentQuerySlice';
import {
  documentsReceived,
  documentsFetchFailed,
  requestCancelled,
  totalCountReceived,
  totalCountFetchFailed,
  themeColorsReceived,
} from './documentQuerySlice';

export const handleExtensionMessage = (
  dispatch: AppDispatch,
  message: MessageFromExtensionToWebview,
): void => {
  switch (message.command) {
    case PreviewMessageType.loadPage:
      dispatch(
        documentsReceived(
          message.documents
            ? (message.documents as PreviewDocument[])
            : [],
        ),
      );
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
      dispatch(themeColorsReceived({
        themeColors: message.themeColors,
        themeKind: message.themeKind,
      }));
      break;
  }
};

export const setupMessageHandler = (dispatch: AppDispatch): (() => void) => {
  const handleMessage = (event: MessageEvent): void => {
    const message: MessageFromExtensionToWebview = event.data;
    handleExtensionMessage(dispatch, message);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
  };
};
