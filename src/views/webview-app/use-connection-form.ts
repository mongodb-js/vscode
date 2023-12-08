import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionInfo } from 'mongodb-data-service-legacy';
import { sendConnectToExtension } from './vscode-api';
import { MESSAGE_TYPES } from './extension-app-message-constants';
import type { MESSAGE_FROM_EXTENSION_TO_WEBVIEW } from './extension-app-message-constants';

export default function useConnectionForm() {
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [connectionAttemptId, setConnectionAttemptId] = useState('');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('');

  useEffect(() => {
    const handleConnectResultResponse = (event) => {
      const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;
      if (
        message.command === MESSAGE_TYPES.CONNECT_RESULT &&
        message.connectionAttemptId === connectionAttemptId
      ) {
        if (message.connectionSuccess) {
          setShowConnectionForm(false);
        } else {
          setConnectionErrorMessage(message.connectionMessage);
        }
      }
    };
    window.addEventListener('message', handleConnectResultResponse);
    () => window.removeEventListener('message', handleConnectResultResponse);
  }, [connectionAttemptId]);

  return {
    showConnectionForm,
    connectionErrorMessage,
    openConnectionForm: () => setShowConnectionForm(true),
    closeConnectionForm: () => setShowConnectionForm(false),
    handleConnectClicked: (connectionInfo: ConnectionInfo) => {
      const nextAttemptId = uuidv4();
      setConnectionAttemptId(nextAttemptId);
      sendConnectToExtension(connectionInfo, nextAttemptId);
    },
  };
}
