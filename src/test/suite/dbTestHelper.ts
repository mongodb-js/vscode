import { promisify } from 'util';

import Connection = require('mongodb-connection-model/lib/model');
import DataService = require('mongodb-data-service');

export const TEST_USER_USERNAME = 'testUser';
export const TEST_USER_PASSWORD = 'password';

export const TEST_DATABASE_URI = 'mongodb://localhost:27018';
export const TEST_DATABASE_URI_USER = `mongodb://${TEST_USER_USERNAME}:${TEST_USER_PASSWORD}@localhost:27018`;

export const TEST_DB_NAME = 'vscodeTestDatabaseAA';

let testDatabaseConnectionModel;

// Note: Be sure to disconnect from the dataservice to free up connections.
export const seedDataAndCreateDataService = async (
  collectionName: string,
  documentsArray: any[]
): Promise<Connection> => {
  if (!testDatabaseConnectionModel) {
    const connectionFrom = promisify(Connection.from.bind(Connection));

    try {
      testDatabaseConnectionModel = await connectionFrom(TEST_DATABASE_URI);
    } catch (error) {
      throw new Error(`Error connecting to ${TEST_DATABASE_URI}: ${error}`);
    }
  }

  const newConnection = new DataService(testDatabaseConnectionModel);
  const connect = promisify(newConnection.connect.bind(newConnection));
  const insertMany = promisify(newConnection.insertMany.bind(newConnection));

  await connect();
  await insertMany(`${TEST_DB_NAME}.${collectionName}`, documentsArray, {});

  return newConnection;
};

export const cleanupTestDB = async (): Promise<void> => {
  const newConnection = new DataService(testDatabaseConnectionModel);
  const connect = promisify(newConnection.connect.bind(newConnection));
  const dropDatabase = promisify(newConnection.dropDatabase.bind(newConnection));
  const disconnect = promisify(newConnection.disconnect.bind(newConnection));

  await connect();
  await dropDatabase(TEST_DB_NAME);
  await disconnect();
};
