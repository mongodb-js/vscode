// Allowed values for the `sshTunnel` field.
export enum SSH_TUNNEL_TYPES {
  /**
   * Do not use SSH tunneling.
   */
  NONE = 'NONE',
  /**
   * The tunnel is created with username and password only.
   */
  USER_PASSWORD = 'USER_PASSWORD',
  /**
   * The tunnel is created using an identity file.
   */
  IDENTITY_FILE = 'IDENTITY_FILE'
}

type SSHTunnelOption = {
  id: SSH_TUNNEL_TYPES;
  title: string;
};

export const SSHTunnelOptions: SSHTunnelOption[] = [
  {
    id: SSH_TUNNEL_TYPES.NONE,
    title: 'None'
  },
  {
    id: SSH_TUNNEL_TYPES.USER_PASSWORD,
    title: 'Use Password'
  },
  {
    id: SSH_TUNNEL_TYPES.IDENTITY_FILE,
    title: 'Use Identity File'
  }
];

export default SSH_TUNNEL_TYPES;
