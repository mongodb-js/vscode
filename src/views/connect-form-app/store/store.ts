
export enum AUTH_STRATEGY_ID {
  NO_AUTH_ROLE = 'NO_AUTH_ROLE',
  MONGODB_AUTH_ROLE = 'MONGODB_AUTH_ROLE',
  SCRAM_SHA_256_AUTH_ROLE = 'SCRAM_SHA_256_AUTH_ROLE'
}

type AuthStrategy = {
  id: AUTH_STRATEGY_ID;
  title: string;
};

export const AuthStrategies: AuthStrategy[] = [{
  id: AUTH_STRATEGY_ID.NO_AUTH_ROLE,
  title: 'None'
}, {
  id: AUTH_STRATEGY_ID.MONGODB_AUTH_ROLE,
  title: 'Username / Password'
}, {
  id: AUTH_STRATEGY_ID.SCRAM_SHA_256_AUTH_ROLE,
  title: 'SCRAM-SHA-256'
}];


export enum SSH_TUNNEL_OPTION_ID {
  NO_SSH_TUNNEL_ROLE = 'NO_SSH_TUNNEL_ROLE',
  PASSWORD_SSH_TUNNEL_ROLE = 'PASSWORD_SSH_TUNNEL_ROLE',
  IDENTITY_FILE_SSH_TUNNEL_ROLE = 'IDENTITY_FILE_SSH_TUNNEL_ROLE'
}

type SSHTunnelOption = {
  id: SSH_TUNNEL_OPTION_ID;
  title: string;
};

export const SSHTunnelOptions: SSHTunnelOption[] = [{
  id: SSH_TUNNEL_OPTION_ID.NO_SSH_TUNNEL_ROLE,
  title: 'None'
}, {
  id: SSH_TUNNEL_OPTION_ID.PASSWORD_SSH_TUNNEL_ROLE,
  title: 'Use Password'
}, {
  id: SSH_TUNNEL_OPTION_ID.IDENTITY_FILE_SSH_TUNNEL_ROLE,
  title: 'Use Identity File'
}];
