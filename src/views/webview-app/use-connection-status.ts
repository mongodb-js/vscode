import { useState, useEffect } from 'react';
import {
  CONNECTION_STATUS,
  type MessageFromExtensionToWebview,
  MessageType,
  type ConnectionStatus,
} from './extension-app-message-constants';
import { getVSCodeApi } from './vscode-api';

const CONNECTION_STATUS_POLLING_FREQ_MS = 1000;

const useConnectionStatus = (): {
  connectionStatus: ConnectionStatus;
  connectionName: string;
} => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.loading,
  );
  const [connectionName, setConnectionName] = useState('');
  useEffect(() => {
    const handleConnectionStatusResponse = (event): void => {
      const message: MessageFromExtensionToWebview = event.data;
      if (message.command === MessageType.connectionStatusMessage) {
        setConnectionStatus(message.connectionStatus);
        setConnectionName(message.activeConnectionName);
      }
    };
    window.addEventListener('message', handleConnectionStatusResponse);

    const requestConnectionStatus = (): void =>
      getVSCodeApi().postMessage({
        command: MessageType.getConnectionStatus,
      });

    requestConnectionStatus();
    const pollingInterval = setInterval(
      requestConnectionStatus,
      CONNECTION_STATUS_POLLING_FREQ_MS,
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
