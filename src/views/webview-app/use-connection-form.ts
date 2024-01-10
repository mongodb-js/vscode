import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionOptions } from 'mongodb-data-service';
import {
  sendConnectToExtension,
  sendCancelConnectToExtension,
} from './vscode-api';
import { MESSAGE_TYPES } from './extension-app-message-constants';
import type { MESSAGE_FROM_EXTENSION_TO_WEBVIEW } from './extension-app-message-constants';

export default function useConnectionForm() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionFormOpened, setConnectionFormOpened] = useState(false);
  const [connectionAttemptId, setConnectionAttemptId] = useState('');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('');

  useEffect(() => {
    const handleConnectResultResponse = (event) => {
      const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;
      if (
        message.command === MESSAGE_TYPES.CONNECT_RESULT &&
        message.connectionAttemptId === connectionAttemptId
      ) {
        setIsConnecting(false);
        if (message.connectionSuccess) {
          setConnectionFormOpened(false);
        } else {
          setConnectionErrorMessage(message.connectionMessage);
        }
      }
    };
    window.addEventListener('message', handleConnectResultResponse);
    () => window.removeEventListener('message', handleConnectResultResponse);
  }, [connectionAttemptId]);

  return {
    connectionFormOpened,
    isConnecting,
    connectionErrorMessage,
    openConnectionForm: () => setConnectionFormOpened(true),
    closeConnectionForm: () => {
      setConnectionFormOpened(false);
      setConnectionErrorMessage('');
    },
    handleCancelConnectClicked: () => {
      sendCancelConnectToExtension();
    },
    handleConnectClicked: (connectionAttempt: {
      id: string;
      connectionOptions: ConnectionOptions;
    }) => {
      // Clears the error message from previous connect attempt
      setConnectionErrorMessage('');

      const nextAttemptId = uuidv4();
      setConnectionAttemptId(nextAttemptId);
      setIsConnecting(true);
      sendConnectToExtension(connectionAttempt, nextAttemptId);
    },
  };
}
