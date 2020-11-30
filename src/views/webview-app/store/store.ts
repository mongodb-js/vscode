import { Actions, ActionTypes, FilePickerActionTypes } from './actions';
import { v4 as uuidv4 } from 'uuid';

import ConnectionModel, {
  DEFAULT_HOST,
  validateConnectionModel
} from '../connection-model/connection-model';
import SSL_METHODS from '../connection-model/constants/ssl-methods';
import {
  CONNECTION_STATUS,
  MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
  MESSAGE_TYPES
} from '../extension-app-message-constants';
import { CONNECTION_FORM_TABS } from './constants';

interface VSCodeApi {
  postMessage: (message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;
const vscode = acquireVsCodeApi();

export interface AppState {
  activeConnectionName: string;
  connectionAttemptId: null | string;
  connectionFormTab: CONNECTION_FORM_TABS;
  connectionMessage: string;
  connectionStatus: CONNECTION_STATUS;
  currentConnection: ConnectionModel;
  isValid: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  errorMessage: string;
  showConnectForm: boolean;
  showResourcesPanel: boolean;
  syntaxErrorMessage: string;
  savedMessage: string;
}

export const initialState: AppState = {
  activeConnectionName: '',
  connectionAttemptId: null,
  connectionFormTab: CONNECTION_FORM_TABS.GENERAL,
  connectionMessage: '',
  connectionStatus: CONNECTION_STATUS.LOADING,
  currentConnection: new ConnectionModel(),
  isValid: true,
  isConnecting: false,
  isConnected: false,
  errorMessage: '',
  showConnectForm: false,
  showResourcesPanel: false,
  syntaxErrorMessage: '',
  savedMessage: ''
};

const showFilePicker = (
  action: FilePickerActionTypes,
  multi: boolean
): void => {
  vscode.postMessage({
    command: MESSAGE_TYPES.OPEN_FILE_PICKER,
    action,
    multi
  });
};

const sendConnectToExtension = (connectionModel: ConnectionModel): string => {
  const connectionAttemptId = uuidv4();

  vscode.postMessage({
    command: MESSAGE_TYPES.CONNECT,
    connectionModel,
    connectionAttemptId
  });

  return connectionAttemptId;
};

// eslint-disable-next-line complexity
export const rootReducer = (
  state: AppState = initialState,
  action: Actions
): AppState => {
  switch (action.type) {
    case ActionTypes.AUTH_SOURCE_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          mongodbDatabaseName: action.mongodbDatabaseName
        }
      };

    case ActionTypes.AUTH_STRATEGY_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          authStrategy: action.authStrategy,

          // Reset the auth fields.
          mongodbUsername: undefined,
          mongodbPassword: undefined,
          mongodbDatabaseName: undefined,
          kerberosPrincipal: undefined,
          kerberosPassword: undefined,
          kerberosServiceName: undefined,
          x509Username: undefined,
          ldapUsername: undefined,
          ldapPassword: undefined
        }
      };

    case ActionTypes.CONNECT:
      if (validateConnectionModel(state.currentConnection)) {
        return {
          ...state,
          isValid: false,
          errorMessage: (
            validateConnectionModel(state.currentConnection) || {
              message: 'The required fields can not be empty.'
            }
          ).message
        };
      }

      return {
        ...state,
        // The form may be displaying a previous error message from a failed connect.
        isValid: true,
        isConnecting: true,
        isConnected: false,
        connectionAttemptId: sendConnectToExtension(state.currentConnection)
      };

    case ActionTypes.CREATE_NEW_PLAYGROUND:
      vscode.postMessage({
        command: MESSAGE_TYPES.CREATE_NEW_PLAYGROUND
      });

      return { ...state };

    case ActionTypes.EXTENSION_LINK_CLICKED:
      vscode.postMessage({
        command: MESSAGE_TYPES.EXTENSION_LINK_CLICKED,
        screen: action.screen,
        linkId: action.linkId
      });

      return { ...state };

    case ActionTypes.CONNECTION_FORM_CHANGED:
      return {
        ...state,
        connectionMessage: '',
        errorMessage: '',
        isValid: true,
        isConnected: false,
        syntaxErrorMessage: ''
      };

    case ActionTypes.CONNECTION_EVENT_OCCURED:
      if (state.connectionAttemptId === action.connectionAttemptId) {
        // Only update to show the connection attempt result
        // when we it is the most recent connection attempt.
        return {
          ...state,
          isConnecting: false,
          isConnected: action.successfullyConnected,
          isValid: action.successfullyConnected ? state.isValid : false,
          errorMessage: action.successfullyConnected ? '' : action.connectionMessage,
          connectionMessage: action.connectionMessage
        };
      }
      return { ...state };

    case ActionTypes.HOSTNAME_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          hostname: action.hostname.trim(),
          sslMethod: /mongodb\.net/i.exec(action.hostname)
            ? SSL_METHODS.SYSTEMCA
            : state.currentConnection.sslMethod
        }
      };

    case ActionTypes.HOSTS_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          hosts: [
            ...(action.hosts ? action.hosts : [DEFAULT_HOST])
          ]
        }
      };

    case ActionTypes.IS_SRV_RECORD_TOGGLED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          isSrvRecord: !state.currentConnection.isSrvRecord
        }
      };

    case ActionTypes.KERBEROS_PARAMETERS_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          kerberosCanonicalizeHostname: action.kerberosCanonicalizeHostname,
          kerberosPassword: action.kerberosPassword,
          kerberosPrincipal: action.kerberosPrincipal,
          kerberosServiceName: action.kerberosServiceName
        }
      };

    case ActionTypes.LDAP_PASSWORD_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          ldapPassword: action.ldapPassword
        }
      };

    case ActionTypes.LDAP_USERNAME_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          ldapUsername: action.ldapUsername
        }
      };

    case ActionTypes.ON_CHANGE_SSH_TUNNEL_IDENTITY_FILE:
      showFilePicker(ActionTypes.SSH_TUNNEL_IDENTITY_FILE_CHANGED, true);

      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sshTunnelIdentityFile: undefined
        }
      };

    case ActionTypes.ON_CHANGE_SSL_CA:
      showFilePicker(ActionTypes.SSL_CA_CHANGED, true);

      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sslCA: undefined
        }
      };

    case ActionTypes.ON_CHANGE_SSL_CERT:
      showFilePicker(ActionTypes.SSL_CERT_CHANGED, true);

      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sslCert: undefined
        }
      };

    case ActionTypes.OPEN_CONNECTION_STRING_INPUT:
      vscode.postMessage({
        command: MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT
      });

      return {
        ...state,
        isConnected: false
      };

    case ActionTypes.PASSWORD_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          mongodbPassword: action.mongodbPassword
        }
      };

    case ActionTypes.PORT_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          port: action.port
        }
      };

    case ActionTypes.READ_PREFERENCE_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          readPreference: action.readPreference
        }
      };

    case ActionTypes.RENAME_CONNECTION:
      vscode.postMessage({
        command: MESSAGE_TYPES.RENAME_ACTIVE_CONNECTION
      });

      return { ...state };

    case ActionTypes.REPLICA_SET_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          replicaSet: action.replicaSet
        }
      };

    case ActionTypes.REQUEST_CONNECTION_STATUS:
      vscode.postMessage({
        command: MESSAGE_TYPES.GET_CONNECTION_STATUS
      });

      return { ...state };

    case ActionTypes.SET_CONNECTION_FORM_TAB:
      return {
        ...state,
        connectionFormTab: action.connectionFormTab
      };

    case ActionTypes.SET_CONNECTION_STATUS:
      return {
        ...state,
        activeConnectionName: action.activeConnectionName,
        connectionStatus: action.connectionStatus
      };

    case ActionTypes.SSH_TUNNEL_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sshTunnel: action.sshTunnel,
          sshTunnelHostname: undefined,
          sshTunnelPort: 22,
          sshTunnelBindToLocalPort: undefined,
          sshTunnelUsername: undefined,
          sshTunnelPassword: undefined,
          sshTunnelIdentityFile: undefined,
          sshTunnelPassphrase: undefined,
          replicaSet: undefined
        }
      };

    case ActionTypes.SSH_TUNNEL_HOSTNAME_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sshTunnelHostname: action.sshTunnelHostname
        }
      };

    case ActionTypes.SSH_TUNNEL_IDENTITY_FILE_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sshTunnelIdentityFile: action.files
        }
      };

    case ActionTypes.SSH_TUNNEL_PASSPHRASE_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sshTunnelPassphrase: action.sshTunnelPassphrase
        }
      };

    case ActionTypes.SSH_TUNNEL_PASSWORD_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sshTunnelPassword: action.sshTunnelPassword
        }
      };

    case ActionTypes.SSH_TUNNEL_PORT_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sshTunnelPort: action.sshTunnelPort
        }
      };

    case ActionTypes.SSH_TUNNEL_USERNAME_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sshTunnelUsername: action.sshTunnelUsername
        }
      };

    case ActionTypes.SSL_CA_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sslCA: action.files
        }
      };

    case ActionTypes.SSL_CERT_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sslCert: action.files,
          sslKey: action.files
        }
      };

    case ActionTypes.SSL_METHOD_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sslMethod: action.sslMethod,
          // Reset the ssl fields:
          sslCA: undefined,
          sslCert: undefined,
          sslKey: undefined,
          sslPass: undefined
        }
      };

    case ActionTypes.SSL_PASS_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sslPass: action.sslPass
        }
      };

    case ActionTypes.TOGGLE_SHOW_CONNECTION_FORM:
      return {
        ...state,
        showConnectForm: !state.showConnectForm
      };

    case ActionTypes.TOGGLE_SHOW_RESOURCES_PANEL:
      return {
        ...state,
        showResourcesPanel: !state.showResourcesPanel
      };

    case ActionTypes.USERNAME_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          mongodbUsername: action.mongodbUsername
        }
      };

    case ActionTypes.X509_USERNAME_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          x509Username: action.x509Username
        }
      };

    default:
      return state;
  }
};
