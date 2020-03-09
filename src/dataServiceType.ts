
export type DataServiceType = {
  connect(callback: (n: Error | undefined) => void): void;
  disconnect(callback: (n: Error | undefined) => void): void;
};
