import { connect, DataService } from 'mongodb-data-service';
import { EJSON } from 'bson';
import * as util from 'util';

export const TEST_USER_USERNAME = 'testUser';
export const TEST_USER_PASSWORD = 'password';

export const TEST_DATABASE_URI = 'mongodb://localhost:27018';
export const TEST_DATABASE_URI_USER = `mongodb://${TEST_USER_USERNAME}:${TEST_USER_PASSWORD}@localhost:27018`;

export const TEST_DB_NAME = 'vscodeTestDatabaseAA';

let testDataService;

export const createTestDataService = async (): Promise<DataService> => {
  testDataService = await connect({ connectionString: TEST_DATABASE_URI });
  return testDataService;
};

export const seedTestDB = async (
  collectionName: string,
  documentsArray: EJSON.SerializableTypes[]
): Promise<void> => {
  const insertMany = util.promisify(testDataService.insertMany.bind(testDataService));
  await insertMany(`${TEST_DB_NAME}.${collectionName}`, documentsArray, {});
};

export const cleanupTestDB = async (): Promise<void> => {
  const dropDatabase = util.promisify(testDataService.dropDatabase.bind(testDataService));
  await dropDatabase(TEST_DB_NAME);
};

export const disconnectFromTestDB = async (): Promise<void> => {
  await testDataService.disconnect();
};
