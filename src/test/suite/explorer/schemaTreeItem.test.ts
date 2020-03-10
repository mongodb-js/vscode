import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';

import SchemaTreeItem from '../../../explorer/schemaTreeItem';
import { fieldIsExpandable } from '../../../explorer/fieldTreeItem';
import {
  seedDataAndCreateDataService,
  cleanupTestDB,
  TEST_DB_NAME
} from '../dbTestHelper';

suite('SchemaTreeItem Test Suite', () => {
  afterEach(function () {
    sinon.restore();
  });

  // To add: show more fields test.

  test('When schema parsing fails it displays an error message', function (done) {
    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {
        find: (ns, filter, options, callback): void => {
          callback(null, 'invalid schema to parse');
        }
      },
      true,
      false,
      null
    );

    testSchemaTreeItem.getChildren().then(schemaFields => {
      assert(schemaFields.length === 0);
      assert(fakeVscodeErrorMessage.called);
      const expectedMessage = 'Unable to parse schema: Unknown input type for `docs`. Must be an array, stream or MongoDB Cursor.';
      assert(
        fakeVscodeErrorMessage.firstArg === expectedMessage,
        `Expected error message to be "${expectedMessage}" found "${fakeVscodeErrorMessage.firstArg}"`
      );
    }).then(done, done);
  });

  suite('Live Database Tests', () => {
    afterEach(async () => {
      await cleanupTestDB();
    });

    test('when not expanded it has not yet pulled the schema', function (done) {
      seedDataAndCreateDataService(
        'favoritePiesIWantToEatRightNow',
        [{
          _id: 10,
          someField: 'applePie'
        }]
      ).then(dataService => {
        const testSchemaTreeItem = new SchemaTreeItem(
          'favoritePiesIWantToEatRightNow',
          TEST_DB_NAME,
          dataService,
          false,
          false,
          null
        );

        testSchemaTreeItem
          .getChildren()
          .then(schemaFields => {
            dataService.disconnect();

            assert(
              schemaFields.length === 0,
              `Expected no schema tree items to be returned, recieved ${schemaFields.length}`
            );
          }).then(done, done);
      });
    });

    test('when expanded shows the fields of a schema', function (done) {
      seedDataAndCreateDataService(
        'favoritePiesIWantToEatRightNow',
        [{
          _id: 1,
          nameOfTastyPie: 'applePie'
        }]
      ).then(dataService => {
        const testSchemaTreeItem = new SchemaTreeItem(
          'favoritePiesIWantToEatRightNow',
          TEST_DB_NAME,
          dataService,
          false,
          false,
          null
        );

        testSchemaTreeItem.onDidExpand();

        testSchemaTreeItem
          .getChildren()
          .then((schemaFields) => {
            dataService.disconnect();
            assert(
              schemaFields.length === 2,
              `Expected 2 schema tree items to be returned, recieved ${schemaFields.length}`
            );
            assert(
              schemaFields[0].label === '_id',
              `Expected label of schema tree item to be the field name, recieved ${schemaFields[0].label}`
            );
            assert(
              schemaFields[1].label === 'nameOfTastyPie',
              `Expected label of schema tree item to be the field name, recieved ${schemaFields[1].label}`
            );
          }).then(done, done);
      });
    });

    test('it only shows a dropdown for fields which are always documents - and not for polymorphic', function (done) {
      seedDataAndCreateDataService(
        'favoritePiesIWantToEatRightNow',
        [{
          _id: 1,
          alwaysDocument: {
            fieldName: 'nice'
          },
          notAlwaysADocument: {
            sureImADocument: 'hmmmm'
          }
        }, {
          _id: 2,
          alwaysDocument: {
            fieldName: 'nice'
          },
          notAlwaysADocument: 'A spy!'
        }]
      ).then(dataService => {
        const testSchemaTreeItem = new SchemaTreeItem(
          'favoritePiesIWantToEatRightNow',
          TEST_DB_NAME,
          dataService,
          false,
          false,
          null
        );

        testSchemaTreeItem.onDidExpand();

        testSchemaTreeItem
          .getChildren()
          .then((schemaFields) => {
            dataService.disconnect();
            assert(
              schemaFields.length === 3,
              `Expected 3 schema tree items to be returned, recieved ${schemaFields.length}`
            );
            assert(
              fieldIsExpandable(schemaFields[1].field),
              'Expected field to have expandable state'
            );
            assert(
              fieldIsExpandable(schemaFields[2].field) === false,
              'Expected field to have none expandable state'
            );
          }).then(done, done);
      });
    });
  });
});
