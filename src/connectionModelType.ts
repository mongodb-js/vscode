import { Host } from './views/webview-app/connection-model/connection-model';
import SSH_TUNNEL_TYPES from './views/webview-app/connection-model/constants/ssh-tunnel-types';

type ConnectionAttributes = {
  driverUrl: string;
  driverUrlWithSsh: string;
  driverOptions: any;
  sshTunnelOptions: {
    host?: string;
    port?: number;
  };
};

export type ConnectionModelType = {
  appname: string;
  hosts: Host[];
  hostname: string;
  isSrvRecord: boolean;
  port: number;
  driverUrl: string;
  driverUrlWithSsh: string;
  sshTunnel?: SSH_TUNNEL_TYPES;
  getAttributes(options?: object): ConnectionAttributes;
  disconnect(callback: (n: Error | undefined) => void): void;
};
