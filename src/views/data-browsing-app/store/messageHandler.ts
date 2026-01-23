import type { MessageFromExtensionToWebview } from '../extension-app-message-constants';
import { PreviewMessageType } from '../extension-app-message-constants';
import type { AppDispatch } from './index';
import {
  handleDocumentsLoaded,
  handleDocumentError,
  handleRequestCancelled,
  handleTotalCountReceived,
  handleTotalCountError,
  type PreviewDocument,
} from './documentQuerySlice';

export const handleExtensionMessage = (
  dispatch: AppDispatch,
  message: MessageFromExtensionToWebview,
): void => {
  switch (message.command) {
    case PreviewMessageType.loadPage:
      dispatch(
        handleDocumentsLoaded((message.documents as PreviewDocument[]) || []),
      );
      break;
    case PreviewMessageType.getDocumentError: {
      const errorMessage = message.error || 'Failed to fetch documents';
      dispatch(handleDocumentError(errorMessage));
      break;
    }
    case PreviewMessageType.requestCancelled:
      dispatch(handleRequestCancelled());
      break;
    case PreviewMessageType.updateTotalCount:
      dispatch(handleTotalCountReceived(message.totalCount));
      break;
    case PreviewMessageType.updateTotalCountError: {
      const errorMessage = message.error || 'Failed to fetch total count';
      dispatch(handleTotalCountError(errorMessage));
      break;
    }
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
