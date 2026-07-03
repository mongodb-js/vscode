import { expect } from 'chai';
import { getDBFromConnectionString } from '../../../utils/connection-string-db';
import { TEST_DATABASE_URI, TEST_DB_NAME } from '../dbTestHelper';

suite('getDBFromConnectionString', function () {
  suite('when connection string has a default database', function () {
    test('it should return the default connected database', function () {
      const defaultDB = getDBFromConnectionString(
        `${TEST_DATABASE_URI}/${TEST_DB_NAME}`,
      );
      expect(defaultDB).to.equal(TEST_DB_NAME);
    });
  });

  suite('when connection string has no default database', function () {
    test('it should return the null', function () {
      const defaultDB = getDBFromConnectionString(
        `${TEST_DATABASE_URI}/${TEST_DB_NAME}`,
      );
      expect(defaultDB).to.be.null;
    });
  });
});
