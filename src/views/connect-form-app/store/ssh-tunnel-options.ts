export enum SSH_TUNNEL_OPTION_ID {
  NONE = 'NONE',
  USER_PASSWORD = 'USER_PASSWORD',
  IDENTITY_FILE = 'IDENTITY_FILE'
}

type SSHTunnelOption = {
  id: SSH_TUNNEL_OPTION_ID;
  title: string;
};

export const SSHTunnelOptions: SSHTunnelOption[] = [{
  id: SSH_TUNNEL_OPTION_ID.NONE,
  title: 'None'
}, {
  id: SSH_TUNNEL_OPTION_ID.USER_PASSWORD,
  title: 'Use Password'
}, {
  id: SSH_TUNNEL_OPTION_ID.IDENTITY_FILE,
  title: 'Use Identity File'
}];
