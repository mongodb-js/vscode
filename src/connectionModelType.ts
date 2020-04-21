type ConnectionAttributes = {
  driverUrl: string;
  driverOptions: any;
  instanceId: string;
};

export type ConnectionModelType = {
  appname: string;
  port: number;

  getAttributes(options: object): ConnectionAttributes;
  disconnect(callback: (n: Error | undefined) => void): void;
};
