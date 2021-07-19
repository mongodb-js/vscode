import Connection = require('mongodb-connection-model/lib/model');
import DataService = require('mongodb-data-service');

export const TEST_USER_USERNAME = 'testUser';
export const TEST_USER_PASSWORD = 'password';

export const TEST_DATABASE_URI = 'mongodb://localhost:27018';
export const TEST_DATABASE_URI_USER = `mongodb://${TEST_USER_USERNAME}:${TEST_USER_PASSWORD}@localhost:27018`;

export const TEST_DB_NAME = 'vscodeTestDatabaseAA';

let testDatabaseConnectionModel;

// Note: Be sure to disconnect from the dataservice to free up connections.
export const seedDataAndCreateDataService = (
  collectionName: string,
  documentsArray: any[]
): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (testDatabaseConnectionModel) {
      const newConnection = new DataService(testDatabaseConnectionModel);
      newConnection.connect((connectError: Error | undefined) => {
        if (connectError) {
          return reject(connectError);
        }

        newConnection.insertMany(
          `${TEST_DB_NAME}.${collectionName}`,
          documentsArray,
          {},
          (insertManyError: Error | undefined) => {
            if (insertManyError) {
              return reject(insertManyError);
            }
            return resolve(newConnection);
          }
        );
      });
    } else {
      Connection.from(
        TEST_DATABASE_URI,
        (connectionModelError: Error | undefined, newConnectionConfig: any) => {
          if (connectionModelError) {
            return reject(connectionModelError);
          }

          testDatabaseConnectionModel = newConnectionConfig;
          const newConnection = new DataService(newConnectionConfig);
          newConnection.connect((connectError: Error | undefined) => {
            if (connectError) {
              return reject(connectError);
            }

            newConnection.insertMany(
              `${TEST_DB_NAME}.${collectionName}`,
              documentsArray,
              {},
              (insertManyError: Error | undefined) => {
                if (insertManyError) {
                  return reject(insertManyError);
                }

                return resolve(newConnection);
              }
            );
          });
        }
      );
    }
  });
};

export const cleanupTestDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const newConnection = new DataService(testDatabaseConnectionModel);
    newConnection.connect((connectError: Error | undefined) => {
      if (connectError) {
        return reject(connectError);
      }

      newConnection.dropDatabase(
        TEST_DB_NAME,
        (dropError: Error | undefined) => {
          if (dropError) {
            return reject(dropError);
          }
          newConnection.disconnect(() => resolve());
        }
      );
    });
  });
};
