import { Actions, ActionTypes, FilePickerActionTypes } from './actions';

import ConnectionModel, {
  validateConnectionModel
} from '../connection-model/connection-model';
import SSL_METHODS from '../connection-model/constants/ssl-methods';
import { MESSAGE_TYPES } from '../extension-app-message-constants';

const vscode = acquireVsCodeApi();

/**
 * All the ssh tunnel related fields on the connection model, with
 * the exception of the method.
 */
// const SSH_TUNNEL_FIELDS = [
//   'sshTunnelHostname',
//   'sshTunnelPort',
//   'sshTunnelBindToLocalPort',
//   'sshTunnelUsername',
//   'sshTunnelPassword',
//   'sshTunnelIdentityFile',
//   'sshTunnelPassphrase',
//   'replicaSet'
// ];

export interface AppState {
  currentConnection: ConnectionModel;
  isValid: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  errorMessage: string;
  syntaxErrorMessage: string;
  isHostChanged: boolean;
  isPortChanged: boolean;
  savedMessage: string;
}

export const initialState = {
  currentConnection: new ConnectionModel(),
  isValid: true,
  isConnecting: false,
  isConnected: false,
  errorMessage: '',
  syntaxErrorMessage: '',
  isHostChanged: false,
  isPortChanged: false,
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
          errorMessage: 'The required fields can not be empty.'
        };
      }

      if (state.isConnecting) {
        return {
          ...state,
          errorMessage: 'Already connecting, please wait.',
          isValid: false
        };
      }

      vscode.postMessage({
        command: MESSAGE_TYPES.CONNECT,
        connectionModel: state.currentConnection
      });

      return {
        ...state,
        // The form may be displaying a previous error message from a failed connect.
        isValid: true,
        isConnecting: true,
        isConnected: false
      };

    case ActionTypes.CONNECTION_FORM_CHANGED:
      return {
        ...state,
        isValid: true,
        isConnected: false,
        errorMessage: '',
        syntaxErrorMessage: ''
      };

    case ActionTypes.CONNECTION_EVENT_OCCURED:
      return {
        ...state,
        isConnecting: false,
        isConnected: action.successfullyConnected,
        isValid: action.successfullyConnected ? state.isValid : false,
        errorMessage: action.successfullyConnected
          ? state.errorMessage
          : action.connectionMessage
      };

    case ActionTypes.HOSTNAME_CHANGED:
      return {
        ...state,
        isHostChanged: true,
        currentConnection: {
          ...state.currentConnection,
          hostname: action.hostname.trim(),
          sslMethod: /mongodb\.net/i.exec(action.hostname)
            ? SSL_METHODS.SYSTEMCA
            : state.currentConnection.sslMethod
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

    case ActionTypes.ON_CHANGE_SSL_KEY:
      showFilePicker(ActionTypes.SSL_KEY_CHANGED, true);

      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          sslKey: undefined
        }
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
        isPortChanged: true,
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

    case ActionTypes.REPLICA_SET_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
          replicaSet: action.replicaSet
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
          sslCert: action.files
        }
      };

    case ActionTypes.SSL_KEY_CHANGED:
      return {
        ...state,
        currentConnection: {
          ...state.currentConnection,
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
