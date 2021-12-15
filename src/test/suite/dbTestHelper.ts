import { connect, DataService } from 'mongodb-data-service';
import { EJSON } from 'bson';
import { promisify } from 'util';

export const TEST_USER_USERNAME = 'testUser';
export const TEST_USER_PASSWORD = 'password';

export const TEST_DATABASE_URI = 'mongodb://localhost:27018';
export const TEST_DATABASE_URI_USER = `mongodb://${TEST_USER_USERNAME}:${TEST_USER_PASSWORD}@localhost:27018`;

export const TEST_DB_NAME = 'vscodeTestDatabaseAA';

let testDataService;

// Note: Be sure to disconnect from the dataservice to free up connections.
export const seedDataAndCreateDataService = async (
  collectionName: string,
  documentsArray: EJSON.SerializableTypes[]
): Promise<DataService> => {
  if (!testDataService) {
    testDataService = await connect({ connectionString: TEST_DATABASE_URI });
  }

  const insertMany = promisify(testDataService.insertMany.bind(testDataService));

  await testDataService.connect();
  await insertMany(`${TEST_DB_NAME}.${collectionName}`, documentsArray, {});

  return testDataService;
};

export const cleanupTestDB = async (): Promise<void> => {
  if (!testDataService) {
    testDataService = await connect({ connectionString: TEST_DATABASE_URI });
  }

  const dropDatabase = promisify(testDataService.dropDatabase.bind(testDataService));

  await testDataService.connect();
  await dropDatabase(TEST_DB_NAME);
  await testDataService.disconnect();
};
