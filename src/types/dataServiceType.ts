import { EJSON } from 'bson';
import { MongoClient } from 'mongodb';

import { ConnectionOptions } from './connectionOptionsType';

export type DataServiceType = {
  connect(callback: (error: Error | undefined) => void): void;
  disconnect(callback: (error: Error | undefined) => void): void;

  getConnectionOptions(): {
    options: ConnectionOptions;
    url: string
  }

  listDatabases(
    callback: (
      error: Error | undefined,
      databases: { name: string }[]
    ) => void
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

  client: {
    client: MongoClient
  };
};
