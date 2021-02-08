import READ_PREFERENCES from '../views/webview-app/connection-model/constants/read-preferences';

export type ConnectionOptions = {
  appname?: string;
  auth?: {
    user: string;
    password: string;
  };
  authSource?: string;
  authMechanism?: string;
  checkServerIdentity?: boolean;
  promoteValues?: boolean;
  sslValidate?: boolean;
  sslCA?: string;
  sslKey?: string;
  sslCert?: string;
  sslPass?: string;
  readPreference: READ_PREFERENCES;
};
