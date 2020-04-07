type ConnectionAttributes = {
  driverUrl: string;
  instanceId: string;
};

export type ConnectionModelType = {
  appname: string;
  port: number;

  getAttributes(options: object): ConnectionAttributes;
  disconnect(callback: (n: Error | undefined) => void): void;
};
