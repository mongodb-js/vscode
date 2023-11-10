import type { DataService } from 'mongodb-data-service';
import { connect } from 'mongodb-data-service';
import type { Document } from 'bson';

export const TEST_USER_USERNAME = 'testUser';
export const TEST_USER_PASSWORD = 'password';

export const TEST_DATABASE_URI = 'mongodb://localhost:27088';
export const TEST_DATABASE_URI_USER = `mongodb://${TEST_USER_USERNAME}:${TEST_USER_PASSWORD}@localhost:27088`;

export const TEST_DB_NAME = 'vscodeTestDatabaseAA';

let testDataService;

export const createTestDataService = async (
  connectionString: string
): Promise<DataService> => {
  testDataService = await connect({
    connectionOptions: { connectionString },
  });
  return testDataService;
};

export const seedTestDB = async (
  collectionName: string,
  documentsArray: Document[]
): Promise<void> => {
  await testDataService.insertMany(
    `${TEST_DB_NAME}.${collectionName}`,
    documentsArray,
    {}
  );
};

export const cleanupTestDB = async (): Promise<void> => {
  await testDataService.dropDatabase(TEST_DB_NAME);
};

export const disconnectFromTestDB = async (): Promise<void> => {
  await testDataService.disconnect();
};
