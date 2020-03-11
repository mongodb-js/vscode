export type DataServiceType = {
  connect(callback: (error: Error | undefined) => void): void;
  disconnect(callback: (error: Error | undefined) => void): void;

  listDatabases(
    callback: (error: Error | undefined, databases: string[]) => void
  ): void;

  createCollection(
    namespace: string,
    options: object,
    callback: (error: Error | undefined) => void
  ): void;

  find(
    namespace: string,
    filter: object,
    options: object,
    callback: (error: Error | undefined, documents: object[]) => void
  ): void;
};
