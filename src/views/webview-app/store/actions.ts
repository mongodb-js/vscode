import READ_PREFERENCES from '../connection-model/constants/read-preferences';
import AUTH_STRATEGIES from '../connection-model/constants/auth-strategies';
import SSL_METHODS from '../connection-model/constants/ssl-methods';
import SSH_TUNNEL_TYPES from '../connection-model/constants/ssh-tunnel-types';

export enum ActionTypes {
  AUTH_SOURCE_CHANGED = 'AUTH_SOURCE_CHANGED',
  AUTH_STRATEGY_CHANGED = 'AUTH_STRATEGY_CHANGED',
  CONNECT = 'CONNECT',
  CONNECTION_EVENT_OCCURED = 'CONNECTION_EVENT_OCCURED',
  CONNECTION_FORM_CHANGED = 'CONNECTION_FORM_CHANGED',
  HOSTNAME_CHANGED = 'HOSTNAME_CHANGED',
  IS_SRV_RECORD_TOGGLED = 'IS_SRV_RECORD_TOGGLED',
  KERBEROS_PARAMETERS_CHANGED = 'KERBEROS_PARAMETERS_CHANGED',
  LDAP_PASSWORD_CHANGED = 'LDAP_PASSWORD_CHANGED',
  LDAP_USERNAME_CHANGED = 'LDAP_USERNAME_CHANGED',
  ON_CHANGE_SSH_TUNNEL_IDENTITY_FILE = 'ON_CHANGE_SSH_TUNNEL_IDENTITY_FILE',
  ON_CHANGE_SSL_CA = 'ON_CHANGE_SSL_CA',
  ON_CHANGE_SSL_CERT = 'ON_CHANGE_SSL_CERT',
  ON_CHANGE_SSL_KEY = 'ON_CHANGE_SSL_KEY',
  OPEN_CONNECTION_STRING_INPUT = 'OPEN_CONNECTION_STRING_INPUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PORT_CHANGED = 'PORT_CHANGED',
  READ_PREFERENCE_CHANGED = 'READ_PREFERENCE_CHANGED',
  REPLICA_SET_CHANGED = 'REPLICA_SET_CHANGED',
  SSH_TUNNEL_CHANGED = 'SSH_TUNNEL_CHANGED',
  SSH_TUNNEL_IDENTITY_FILE_CHANGED = 'SSH_TUNNEL_IDENTITY_FILE_CHANGED',
  SSH_TUNNEL_HOSTNAME_CHANGED = 'SSH_TUNNEL_HOSTNAME_CHANGED',
  SSH_TUNNEL_PASSPHRASE_CHANGED = 'SSH_TUNNEL_PASSPHRASE_CHANGED',
  SSH_TUNNEL_PASSWORD_CHANGED = 'SSH_TUNNEL_PASSWORD_CHANGED',
  SSH_TUNNEL_PORT_CHANGED = 'SSH_TUNNEL_PORT_CHANGED',
  SSH_TUNNEL_USERNAME_CHANGED = 'SSH_TUNNEL_USERNAME_CHANGED',
  SSL_CA_CHANGED = 'SSL_CA_CHANGED',
  SSL_CERT_CHANGED = 'SSL_CERT_CHANGED',
  SSL_KEY_CHANGED = 'SSL_KEY_CHANGED',
  SSL_METHOD_CHANGED = 'SSL_METHOD_CHANGED',
  SSL_PASS_CHANGED = 'SSL_PASS_CHANGED',
  USERNAME_CHANGED = 'USERNAME_CHANGED',
  X509_USERNAME_CHANGED = 'X509_USERNAME_CHANGED',
}

export type FilePickerActionTypes =
  | ActionTypes.SSH_TUNNEL_IDENTITY_FILE_CHANGED
  | ActionTypes.SSL_CA_CHANGED
  | ActionTypes.SSL_CERT_CHANGED
  | ActionTypes.SSL_KEY_CHANGED;

export interface BaseAction {
  type: ActionTypes;
}

export interface AuthSourceChangedAction extends BaseAction {
  type: ActionTypes.AUTH_SOURCE_CHANGED;
  mongodbDatabaseName?: string;
}

export interface AuthStrategyChangedAction extends BaseAction {
  type: ActionTypes.AUTH_STRATEGY_CHANGED;
  authStrategy: AUTH_STRATEGIES;
}

export interface ConnectAction extends BaseAction {
  type: ActionTypes.CONNECT;
}

export interface ConnectionEventOccuredAction extends BaseAction {
  type: ActionTypes.CONNECTION_EVENT_OCCURED;
  successfullyConnected: boolean;
  connectionMessage: string;
}

export interface ConnectionFormChangedAction extends BaseAction {
  type: ActionTypes.CONNECTION_FORM_CHANGED;
}

export interface HostnameChangedAction extends BaseAction {
  type: ActionTypes.HOSTNAME_CHANGED;
  hostname: string;
}

export interface IsSrvRecordToggledAction extends BaseAction {
  type: ActionTypes.IS_SRV_RECORD_TOGGLED;
}

export interface KerberosParameters {
  kerberosCanonicalizeHostname: boolean;
  kerberosPassword?: string;
  kerberosPrincipal?: string;
  kerberosServiceName?: string;
}

export interface KerberosParametersChanged
  extends BaseAction,
    KerberosParameters {
  type: ActionTypes.KERBEROS_PARAMETERS_CHANGED;
}

export interface KerberosParametersChanged
  extends BaseAction,
    KerberosParameters {
  type: ActionTypes.KERBEROS_PARAMETERS_CHANGED;
}

export interface LDAPPasswordChangedAction extends BaseAction {
  type: ActionTypes.LDAP_PASSWORD_CHANGED;
  ldapPassword: string;
}
export interface LDAPUsernameChangedAction extends BaseAction {
  type: ActionTypes.LDAP_USERNAME_CHANGED;
  ldapUsername: string;
}

export interface OnChangeSSHTunnelIdentityFileAction extends BaseAction {
  type: ActionTypes.ON_CHANGE_SSH_TUNNEL_IDENTITY_FILE;
}

export interface OnChangeSSLCAAction extends BaseAction {
  type: ActionTypes.ON_CHANGE_SSL_CA;
}

export interface OnChangeSSLCertAction extends BaseAction {
  type: ActionTypes.ON_CHANGE_SSL_CERT;
}

export interface OnChangeSSLKeyAction extends BaseAction {
  type: ActionTypes.ON_CHANGE_SSL_KEY;
}

export interface OpenConnectionStringInputAction extends BaseAction {
  type: ActionTypes.OPEN_CONNECTION_STRING_INPUT;
}

export interface PasswordChangedAction extends BaseAction {
  type: ActionTypes.PASSWORD_CHANGED;
  mongodbPassword: string;
}

export interface PortChangedAction extends BaseAction {
  type: ActionTypes.PORT_CHANGED;
  port: number;
}

export interface ReadPreferenceChangedAction extends BaseAction {
  type: ActionTypes.READ_PREFERENCE_CHANGED;
  readPreference: READ_PREFERENCES;
}

export interface ReplicaSetChangedAction extends BaseAction {
  type: ActionTypes.REPLICA_SET_CHANGED;
  replicaSet: string;
}

export interface SSHTunnelChangedAction extends BaseAction {
  type: ActionTypes.SSH_TUNNEL_CHANGED;
  sshTunnel: SSH_TUNNEL_TYPES;
}

export interface SSHTunnelHostnameChangedAction extends BaseAction {
  type: ActionTypes.SSH_TUNNEL_HOSTNAME_CHANGED;
  sshTunnelHostname: string;
}

export interface SSHTunnelIdentityFileChangedAction extends BaseAction {
  type: ActionTypes.SSH_TUNNEL_IDENTITY_FILE_CHANGED;
  files: string[] | undefined;
}

export interface SSHTunnelPassphraseChangedAction extends BaseAction {
  type: ActionTypes.SSH_TUNNEL_PASSPHRASE_CHANGED;
  sshTunnelPassphrase: string;
}

export interface SSHTunnelPasswordChangedAction extends BaseAction {
  type: ActionTypes.SSH_TUNNEL_PASSWORD_CHANGED;
  sshTunnelPassword: string;
}

export interface SSHTunnelPortChangedAction extends BaseAction {
  type: ActionTypes.SSH_TUNNEL_PORT_CHANGED;
  sshTunnelPort: number;
}

export interface SSHTunnelUsernameChangedAction extends BaseAction {
  type: ActionTypes.SSH_TUNNEL_USERNAME_CHANGED;
  sshTunnelUsername: string;
}

export interface SSLCAChangedAction extends BaseAction {
  type: ActionTypes.SSL_CA_CHANGED;
  files: string[] | undefined;
}

export interface SSLCertChangedAction extends BaseAction {
  type: ActionTypes.SSL_CERT_CHANGED;
  files: string[] | undefined;
}

export interface SSLKeyChangedAction extends BaseAction {
  type: ActionTypes.SSL_KEY_CHANGED;
  files: string[] | undefined;
}

export interface SSLMethodChangedAction extends BaseAction {
  type: ActionTypes.SSL_METHOD_CHANGED;
  sslMethod: SSL_METHODS;
}

export interface SSLPassChangedAction extends BaseAction {
  type: ActionTypes.SSL_PASS_CHANGED;
  sslPass: string;
}

export interface UsernameChangedAction extends BaseAction {
  type: ActionTypes.USERNAME_CHANGED;
  mongodbUsername: string;
}

export interface X509UsernameChangedAction extends BaseAction {
  type: ActionTypes.X509_USERNAME_CHANGED;
  x509Username: string;
}

export type FilePickerActions =
  | SSHTunnelIdentityFileChangedAction
  | SSLCAChangedAction
  | SSLCertChangedAction
  | SSLKeyChangedAction;

export type Actions =
  | AuthSourceChangedAction
  | AuthStrategyChangedAction
  | ConnectAction
  | ConnectionEventOccuredAction
  | ConnectionFormChangedAction
  | HostnameChangedAction
  | IsSrvRecordToggledAction
  | KerberosParametersChanged
  | LDAPPasswordChangedAction
  | LDAPUsernameChangedAction
  | OnChangeSSHTunnelIdentityFileAction
  | OnChangeSSLCAAction
  | OnChangeSSLCertAction
  | OnChangeSSLKeyAction
  | OpenConnectionStringInputAction
  | PasswordChangedAction
  | PortChangedAction
  | ReadPreferenceChangedAction
  | ReplicaSetChangedAction
  | SSHTunnelChangedAction
  | SSHTunnelHostnameChangedAction
  | SSHTunnelIdentityFileChangedAction
  | SSHTunnelPassphraseChangedAction
  | SSHTunnelPasswordChangedAction
  | SSHTunnelPortChangedAction
  | SSHTunnelUsernameChangedAction
  | SSLCAChangedAction
  | SSLCertChangedAction
  | SSLKeyChangedAction
  | SSLMethodChangedAction
  | SSLPassChangedAction
  | UsernameChangedAction
  | X509UsernameChangedAction;
