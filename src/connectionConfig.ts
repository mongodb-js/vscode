
export type ConnectionAttributes = {
  driverUrl: string;
  instanceId: string;
};

export type ConnectionConfigType = {
  appname: string;

  getAttributes(options: object): ConnectionAttributes;
  disconnect(callback: (n: Error | undefined) => void): void;
};
