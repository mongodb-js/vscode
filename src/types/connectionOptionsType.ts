import READ_PREFERENCES from '../views/webview-app/connection-model/constants/read-preferences';

export type ConnectionOptions = {
  appname?: string;
  auth?: {
    user: string;
    password: string;
  };
  useUnifiedTopology?: boolean;
  useNewUrlParser?: boolean;
  port?: number;
  authSource?: string;
  authMechanism?: string;
  checkServerIdentity?: boolean;
  promoteValues?: boolean;
  sslValidate?: boolean;
  sslCA?: string | string[];
  sslKey?: string | string[];
  sslCert?: string | string[];
  sslPass?: string;
  readPreference?: READ_PREFERENCES;
};
