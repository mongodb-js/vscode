import type READ_PREFERENCES from '../connection-model/constants/read-preferences';
import type AUTH_STRATEGIES from '../connection-model/constants/auth-strategies';
import type SSL_METHODS from '../connection-model/constants/ssl-methods';
import type SSH_TUNNEL_TYPES from '../connection-model/constants/ssh-tunnel-types';
import type { CONNECTION_STATUS } from '../../extension-app-message-constants';
import type { CONNECTION_FORM_TABS } from './constants';
import type { Host } from '../connection-model/legacy-connection-model';

export enum ActionTypes {
  AUTH_SOURCE_CHANGED = 'AUTH_SOURCE_CHANGED',
  AUTH_STRATEGY_CHANGED = 'AUTH_STRATEGY_CHANGED',
  CONNECT = 'CONNECT',
  CONNECTION_EVENT_OCCURED = 'CONNECTION_EVENT_OCCURED',
  CONNECTION_FORM_CHANGED = 'CONNECTION_FORM_CHANGED',
  CREATE_NEW_PLAYGROUND = 'CREATE_NEW_PLAYGROUND',
  HOSTNAME_CHANGED = 'HOSTNAME_CHANGED',
  HOSTS_CHANGED = 'HOSTS_CHANGED',
  IS_SRV_RECORD_TOGGLED = 'IS_SRV_RECORD_TOGGLED',
  EXTENSION_LINK_CLICKED = 'EXTENSION_LINK_CLICKED',
  LDAP_PASSWORD_CHANGED = 'LDAP_PASSWORD_CHANGED',
  LDAP_USERNAME_CHANGED = 'LDAP_USERNAME_CHANGED',
  ON_CHANGE_SSH_TUNNEL_IDENTITY_FILE = 'ON_CHANGE_SSH_TUNNEL_IDENTITY_FILE',
  ON_CHANGE_SSL_CA = 'ON_CHANGE_SSL_CA',
  ON_CHANGE_SSL_CERT = 'ON_CHANGE_SSL_CERT',
  OPEN_CONNECTION_STRING_INPUT = 'OPEN_CONNECTION_STRING_INPUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PORT_CHANGED = 'PORT_CHANGED',
  READ_PREFERENCE_CHANGED = 'READ_PREFERENCE_CHANGED',
  RENAME_CONNECTION = 'RENAME_CONNECTION',
  REPLICA_SET_CHANGED = 'REPLICA_SET_CHANGED',
  REQUEST_CONNECTION_STATUS = 'REQUEST_CONNECTION_STATUS',
  SET_CONNECTION_FORM_TAB = 'SET_CONNECTION_FORM_TAB',
  SET_CONNECTION_STATUS = 'SET_CONNECTION_STATUS',
  SSH_TUNNEL_CHANGED = 'SSH_TUNNEL_CHANGED',
  SSH_TUNNEL_IDENTITY_FILE_CHANGED = 'SSH_TUNNEL_IDENTITY_FILE_CHANGED',
  SSH_TUNNEL_HOSTNAME_CHANGED = 'SSH_TUNNEL_HOSTNAME_CHANGED',
  SSH_TUNNEL_PASSPHRASE_CHANGED = 'SSH_TUNNEL_PASSPHRASE_CHANGED',
  SSH_TUNNEL_PASSWORD_CHANGED = 'SSH_TUNNEL_PASSWORD_CHANGED',
  SSH_TUNNEL_PORT_CHANGED = 'SSH_TUNNEL_PORT_CHANGED',
  SSH_TUNNEL_USERNAME_CHANGED = 'SSH_TUNNEL_USERNAME_CHANGED',
  SSL_CA_CHANGED = 'SSL_CA_CHANGED',
  SSL_CERT_CHANGED = 'SSL_CERT_CHANGED',
  SSL_METHOD_CHANGED = 'SSL_METHOD_CHANGED',
  SSL_PASS_CHANGED = 'SSL_PASS_CHANGED',
  TOGGLE_SHOW_CONNECTION_FORM = 'TOGGLE_SHOW_CONNECTION_FORM',
  TOGGLE_SHOW_RESOURCES_PANEL = 'TOGGLE_SHOW_RESOURCES_PANEL',
  TRUSTED_LINK_CLICKED = 'TRUSTED_LINK_CLICKED',
  USERNAME_CHANGED = 'USERNAME_CHANGED',
  X509_USERNAME_CHANGED = 'X509_USERNAME_CHANGED',
}

export type FilePickerActionTypes =
  | ActionTypes.SSH_TUNNEL_IDENTITY_FILE_CHANGED
  | ActionTypes.SSL_CA_CHANGED
  | ActionTypes.SSL_CERT_CHANGED;

export interface BaseAction {
  type: ActionTypes;
}

export interface LinkClickedAction extends BaseAction {
  type: ActionTypes.EXTENSION_LINK_CLICKED;
  screen: string;
  linkId: string;
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
  connectionAttemptId: string;
}

export interface ConnectionFormChangedAction extends BaseAction {
  type: ActionTypes.CONNECTION_FORM_CHANGED;
}

export interface CreateNewPlaygroundAction extends BaseAction {
  type: ActionTypes.CREATE_NEW_PLAYGROUND;
}

export interface HostnameChangedAction extends BaseAction {
  type: ActionTypes.HOSTNAME_CHANGED;
  hostname: string;
}

export interface HostsChangedAction extends BaseAction {
  type: ActionTypes.HOSTS_CHANGED;
  hosts: Host[];
}

export interface IsSrvRecordToggledAction extends BaseAction {
  type: ActionTypes.IS_SRV_RECORD_TOGGLED;
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

export interface RenameConnectionAction extends BaseAction {
  type: ActionTypes.RENAME_CONNECTION;
}

export interface ReplicaSetChangedAction extends BaseAction {
  type: ActionTypes.REPLICA_SET_CHANGED;
  replicaSet?: string;
}

export interface RequestConnectionStatusAction extends BaseAction {
  type: ActionTypes.REQUEST_CONNECTION_STATUS;
}

export interface SetConnectionFormTabAction extends BaseAction {
  type: ActionTypes.SET_CONNECTION_FORM_TAB;
  connectionFormTab: CONNECTION_FORM_TABS;
}

export interface SetConnectionStatusAction extends BaseAction {
  type: ActionTypes.SET_CONNECTION_STATUS;
  connectionStatus: CONNECTION_STATUS;
  activeConnectionName: string;
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

export interface SSLMethodChangedAction extends BaseAction {
  type: ActionTypes.SSL_METHOD_CHANGED;
  sslMethod: SSL_METHODS;
}

export interface SSLPassChangedAction extends BaseAction {
  type: ActionTypes.SSL_PASS_CHANGED;
  sslPass: string;
}

export interface ToggleShowConnectionFormAction extends BaseAction {
  type: ActionTypes.TOGGLE_SHOW_CONNECTION_FORM;
}

export interface ToggleShowResourcesPanelAction extends BaseAction {
  type: ActionTypes.TOGGLE_SHOW_RESOURCES_PANEL;
}

export interface TrustedLinkClickedAction extends BaseAction {
  type: ActionTypes.TRUSTED_LINK_CLICKED;
  linkTo: string;
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
  | SSLCertChangedAction;

export type Actions =
  | AuthSourceChangedAction
  | AuthStrategyChangedAction
  | ConnectAction
  | ConnectionEventOccuredAction
  | ConnectionFormChangedAction
  | CreateNewPlaygroundAction
  | HostnameChangedAction
  | HostsChangedAction
  | IsSrvRecordToggledAction
  | LDAPPasswordChangedAction
  | LDAPUsernameChangedAction
  | LinkClickedAction
  | OnChangeSSHTunnelIdentityFileAction
  | OnChangeSSLCAAction
  | OnChangeSSLCertAction
  | OpenConnectionStringInputAction
  | PasswordChangedAction
  | PortChangedAction
  | ReadPreferenceChangedAction
  | RenameConnectionAction
  | ReplicaSetChangedAction
  | RequestConnectionStatusAction
  | SetConnectionFormTabAction
  | SetConnectionStatusAction
  | SSHTunnelChangedAction
  | SSHTunnelHostnameChangedAction
  | SSHTunnelIdentityFileChangedAction
  | SSHTunnelPassphraseChangedAction
  | SSHTunnelPasswordChangedAction
  | SSHTunnelPortChangedAction
  | SSHTunnelUsernameChangedAction
  | SSLCAChangedAction
  | SSLCertChangedAction
  | SSLMethodChangedAction
  | SSLPassChangedAction
  | ToggleShowConnectionFormAction
  | ToggleShowResourcesPanelAction
  | TrustedLinkClickedAction
  | UsernameChangedAction
  | X509UsernameChangedAction;
