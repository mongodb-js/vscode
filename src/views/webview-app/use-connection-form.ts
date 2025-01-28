import { useEffect, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionOptions } from 'mongodb-data-service';

import {
  sendConnectToExtension,
  sendCancelConnectToExtension,
  sendFormOpenedToExtension,
  sendEditConnectionToExtension,
  sendOpenFileChooserToExtension,
} from './vscode-api';
import { MESSAGE_TYPES } from './extension-app-message-constants';
import type { MessageFromExtensionToWebview } from './extension-app-message-constants';
import type { ElectronFileDialogOptions } from '@mongodb-js/compass-components';

export enum FILE_CHOOSER_MODE {
  OPEN = 'open',
  SAVE = 'save',
}

export type FileChooserOptions = {
  electronFileDialogOptions?: Partial<ElectronFileDialogOptions>;
  mode: FILE_CHOOSER_MODE;
};

type ConnectionInfo = {
  id: string;
  connectionOptions: ConnectionOptions;
  favorite?: {
    name: string;
  };
};

function createNewConnectionInfo(): ConnectionInfo {
  return {
    id: uuidv4(),
    connectionOptions: {
      connectionString: 'mongodb://localhost:27017',
    },
  };
}

type State = {
  initialConnectionInfo: ConnectionInfo;
  isConnecting: boolean;
  isConnectionFormOpen: boolean;
  isEditingConnection: boolean;
  connectionErrorMessage: string;
};

export function getDefaultConnectionFormState(): State {
  return {
    initialConnectionInfo: createNewConnectionInfo(),
    isConnecting: false,
    isConnectionFormOpen: false,
    isEditingConnection: false,
    connectionErrorMessage: '',
  };
}

type Action =
  | {
      type: 'open-connection-form';
    }
  | {
      type: 'close-connection-form';
    }
  | {
      type: 'connection-result';
      connectionSuccess: boolean;
      connectionMessage: string;
    }
  | {
      type: 'open-edit-connection';
      connectionInfo: {
        id: string;
        favorite: {
          name: string;
        };
        connectionOptions: ConnectionOptions;
      };
    }
  | {
      type: 'attempt-connect';
    };

function connectionFormReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'open-connection-form':
      return {
        ...state,
        isConnectionFormOpen: true,
        isConnecting: false,
        isEditingConnection: false,
        connectionErrorMessage: '',
        initialConnectionInfo: createNewConnectionInfo(),
      };
    case 'close-connection-form':
      return {
        ...state,
        isConnectionFormOpen: false,
      };
    case 'connection-result':
      return {
        ...state,
        isConnecting: false,
        connectionErrorMessage: action.connectionMessage,
        isConnectionFormOpen: !action.connectionSuccess,
      };
    case 'open-edit-connection':
      return {
        ...state,
        isConnectionFormOpen: true,
        isConnecting: false,
        isEditingConnection: true,
        connectionErrorMessage: '',
        initialConnectionInfo: action.connectionInfo,
      };
    case 'attempt-connect':
      return {
        ...state,
        // Clear the error message from previous connect attempt.
        connectionErrorMessage: '',
        isConnecting: true,
      };
    default:
      return state;
  }
}

export default function useConnectionForm(): {
  isConnectionFormOpen: boolean;
  isConnecting: boolean;
  initialConnectionInfo: ConnectionInfo;
  connectionErrorMessage: string;
  openConnectionForm: () => void;
  closeConnectionForm: () => void;
  handleOpenFileChooser: (options: FileChooserOptions) => string;
  handleCancelConnectClicked: () => void;
  handleSaveConnectionClicked: () => Promise<void>;
  handleConnectClicked: (connectionAttempt: {
    id: string;
    connectionOptions: ConnectionOptions;
  }) => void;
} {
  const [
    {
      initialConnectionInfo,
      isConnecting,
      isConnectionFormOpen,
      isEditingConnection,
      connectionErrorMessage,
    },
    dispatch,
  ] = useReducer(connectionFormReducer, {
    ...getDefaultConnectionFormState(),
  });

  useEffect(() => {
    const handleConnectResultResponse = (event): void => {
      const message: MessageFromExtensionToWebview = event.data;
      if (
        message.command === MESSAGE_TYPES.CONNECT_RESULT &&
        message.connectionId === initialConnectionInfo.id
      ) {
        dispatch({
          type: 'connection-result',
          connectionSuccess: message.connectionSuccess,
          connectionMessage: message.connectionMessage,
        });
      }
    };
    window.addEventListener('message', handleConnectResultResponse);
    return () => {
      window.removeEventListener('message', handleConnectResultResponse);
    };
  }, [initialConnectionInfo]);

  useEffect(() => {
    const handleConnectResultResponse = (event): void => {
      const message: MessageFromExtensionToWebview = event.data;
      if (message.command === MESSAGE_TYPES.OPEN_EDIT_CONNECTION) {
        dispatch({
          type: 'open-edit-connection',
          connectionInfo: {
            id: message.connection.id,
            favorite: {
              name: message.connection.name,
            },
            connectionOptions: message.connection.connectionOptions,
          },
        });
      }
    };
    window.addEventListener('message', handleConnectResultResponse);
    return (): void => {
      window.removeEventListener('message', handleConnectResultResponse);
    };
  }, []);

  return {
    isConnectionFormOpen,
    isConnecting,
    initialConnectionInfo,
    connectionErrorMessage,
    openConnectionForm: (): void => {
      dispatch({
        type: 'open-connection-form',
      });
      sendFormOpenedToExtension();
    },
    closeConnectionForm: (): void => {
      dispatch({
        type: 'close-connection-form',
      });
    },
    handleOpenFileChooser: (options: FileChooserOptions): string => {
      const requestId = uuidv4();
      sendOpenFileChooserToExtension(options, requestId);
      return requestId;
    },
    handleCancelConnectClicked: (): void => {
      sendCancelConnectToExtension();
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handleSaveConnectionClicked: (): Promise<void> => {
      // no-op, this cannot be called as don't set the `showFavoriteActions` setting.
      return Promise.resolve();
    },
    handleConnectClicked: (connectionAttempt: {
      id: string;
      connectionOptions: ConnectionOptions;
    }): void => {
      dispatch({
        type: 'attempt-connect',
      });

      if (isEditingConnection) {
        sendEditConnectionToExtension(connectionAttempt);
      } else {
        sendConnectToExtension(connectionAttempt);
      }
    },
  };
}
