export type ConnectionOptions = {
  appname?: string;
  auth?: {
    user: string;
    password: string;
  };
  authSource?: string;
  authMechanism?: string;
  sslCA?: string;
  sslKey?: string;
  sslCert?: string;
  sslPass?: string;
};
