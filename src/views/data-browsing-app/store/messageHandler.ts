import { store } from './index';
import type { MessageFromExtensionToWebview } from '../extension-app-message-constants';
import { PreviewMessageType } from '../extension-app-message-constants';
import {
  loadPage,
  stopLoading,
  setTotalCountInCollection,
  markCountReceived,
  setRequestError,
  type PreviewDocument,
} from './documentQuerySlice';

export const handleExtensionMessage = (
  message: MessageFromExtensionToWebview,
): void => {
  switch (message.command) {
    case PreviewMessageType.loadPage:
      store.dispatch(loadPage((message.documents as PreviewDocument[]) || []));
      break;
    case PreviewMessageType.getDocumentError: {
      const errorMessage = message.error || 'Failed to fetch documents';
      store.dispatch(
        setRequestError({ type: 'getDocuments', message: errorMessage }),
      );
      break;
    }
    case PreviewMessageType.requestCancelled:
      store.dispatch(stopLoading());
      break;
    case PreviewMessageType.updateTotalCount:
      store.dispatch(setTotalCountInCollection(message.totalCount));
      break;
    case PreviewMessageType.updateTotalCountError: {
      const errorMessage = message.error || 'Failed to fetch total count';
      store.dispatch(markCountReceived());
      store.dispatch(
        setRequestError({ type: 'getTotalCount', message: errorMessage }),
      );
      break;
    }
  }
};

export const setupMessageHandler = (): (() => void) => {
  const handleMessage = (event: MessageEvent): void => {
    const message: MessageFromExtensionToWebview = event.data;
    handleExtensionMessage(message);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
  };
};
