import { useState, useEffect } from 'react';
import {
  CONNECTION_STATUS,
  type MessageFromExtensionToWebview,
  MESSAGE_TYPES,
} from './extension-app-message-constants';
import vscode from './vscode-api';

const CONNECTION_STATUS_POLLING_FREQ_MS = 1000;

const useConnectionStatus = (): {
  connectionStatus: CONNECTION_STATUS;
  connectionName: string;
} => {
  const [connectionStatus, setConnectionStatus] = useState<CONNECTION_STATUS>(
    CONNECTION_STATUS.LOADING
  );
  const [connectionName, setConnectionName] = useState('');
  useEffect(() => {
    const handleConnectionStatusResponse = (event) => {
      const message: MessageFromExtensionToWebview = event.data;
      if (message.command === MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE) {
        setConnectionStatus(message.connectionStatus);
        setConnectionName(message.activeConnectionName);
      }
    };
    window.addEventListener('message', handleConnectionStatusResponse);

    const requestConnectionStatus = (): void =>
      vscode.postMessage({
        command: MESSAGE_TYPES.GET_CONNECTION_STATUS,
      });

    requestConnectionStatus();
    const pollingInterval = setInterval(
      requestConnectionStatus,
      CONNECTION_STATUS_POLLING_FREQ_MS
    );
    return () => {
      window.removeEventListener('message', handleConnectionStatusResponse);
      clearInterval(pollingInterval);
    };
  }, []);

  return {
    connectionStatus,
    connectionName,
  };
};

export default useConnectionStatus;
