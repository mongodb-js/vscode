import { Document } from 'bson';
import { MongoClient } from 'mongodb';
import { buildConnectionModelFromConnectionString, buildConnectionStringFromConnectionModel, getDriverOptionsFromConnectionModel } from '../../views/webview-app/connection-model/connection-model';

export const TEST_DB_INSTANCE_ID = 'localhost:27018';
export const TEST_DATABASE_URI = 'mongodb://localhost:27018';

export const TEST_DB_NAME = 'vscodeTestDatabaseAA';

let testDatabaseConnectionModel;

// Note: Be sure to disconnect from the dataservice to free up connections.
export const seedDataAndCreateDataService = async (
  collectionName: string,
  documentsArray: Document[]
): Promise<MongoClient> => {
  if (!testDatabaseConnectionModel) {
    testDatabaseConnectionModel = buildConnectionModelFromConnectionString(
      TEST_DATABASE_URI
    );
  }

  const dataService = new MongoClient(
    buildConnectionStringFromConnectionModel(testDatabaseConnectionModel),
    getDriverOptionsFromConnectionModel(testDatabaseConnectionModel)
  );
  try {
    await dataService.connect();

    dataService
      .db(TEST_DB_NAME)
      .collection(collectionName)
      .insertMany(documentsArray);
  } catch (err) {
    return Promise.reject(err);
  }

  // TODO: Maybe we add a timeout to ensure we auto cleanup connections.

  return dataService;
};

export const cleanupTestDB = async (): Promise<void> => {
  const dataService = new MongoClient(
    buildConnectionStringFromConnectionModel(testDatabaseConnectionModel),
    getDriverOptionsFromConnectionModel(testDatabaseConnectionModel)
  );

  await dataService.connect();

  await dataService.db(TEST_DB_NAME).dropDatabase();

  await dataService.close();
};
