import { EJSON } from 'bson';
import { ConnectionOptions } from './connectionOptionsType';

export type DataServiceType = {
  connect(callback: (error: Error | undefined) => void): void;
  disconnect(callback: (error: Error | undefined) => void): void;

  getConnectionOptions(): {
    options: ConnectionOptions;
    url: string
  }

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

  findOneAndReplace(
    namespace: string,
    filter: object,
    replacement: EJSON.SerializableTypes,
    options: object,
    callback: (error: Error | undefined, result?: object) => void
  ): void;

  instance(opts: any, callback: any): any;

  client: any;
};
