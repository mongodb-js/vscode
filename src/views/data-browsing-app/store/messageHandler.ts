import { store } from './index';
import type { MessageFromExtensionToWebview } from '../extension-app-message-constants';
import { PreviewMessageType } from '../extension-app-message-constants';
import {
  loadDocuments,
  loadPage,
  stopLoading,
  setTotalCountInCollection,
  markCountReceived,
  type PreviewDocument,
} from './documentQuerySlice';

export const handleExtensionMessage = (
  message: MessageFromExtensionToWebview,
): void => {
  switch (message.command) {
    case PreviewMessageType.loadDocuments:
      store.dispatch(
        loadDocuments((message.documents as PreviewDocument[]) || []),
      );
      break;
    case PreviewMessageType.loadPage:
      store.dispatch(loadPage((message.documents as PreviewDocument[]) || []));
      break;
    case PreviewMessageType.refreshError:
      store.dispatch(stopLoading());
      // Could dispatch an error action here if we want to display error messages
      break;
    case PreviewMessageType.requestCancelled:
      store.dispatch(stopLoading());
      break;
    case PreviewMessageType.updateTotalCount:
      store.dispatch(setTotalCountInCollection(message.totalCount));
      break;
    case PreviewMessageType.updateTotalCountError:
      // Count fetch failed - mark as received with null value
      store.dispatch(markCountReceived());
      break;
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

