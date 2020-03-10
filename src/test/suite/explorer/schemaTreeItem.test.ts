import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';

import SchemaTreeItem, {
  FIELDS_TO_SHOW
} from '../../../explorer/schemaTreeItem';
import { fieldIsExpandable } from '../../../explorer/fieldTreeItem';
import {
  seedDataAndCreateDataService,
  cleanupTestDB,
  TEST_DB_NAME
} from '../dbTestHelper';

suite('SchemaTreeItem Test Suite', () => {
  afterEach(() => {
    sinon.restore();
  });

  test('when the "show more" click handler function is called it sets the schema to show more fields', () => {
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {},
      false,
      false,
      null
    );

    assert(
      !testSchemaTreeItem.hasClickedShowMoreFields,
      'Expected "hasClickedShowMoreFields" to be false by default'
    );
    testSchemaTreeItem._childrenCacheIsUpToDate = true;

    testSchemaTreeItem.onShowMoreClicked();

    assert(
      !testSchemaTreeItem._childrenCacheIsUpToDate,
      'Expected `_childrenCacheIsUpToDate` to be reset to false'
    );
    assert(
      testSchemaTreeItem.hasClickedShowMoreFields,
      'Expected "hasClickedShowMoreFields" to be set to true'
    );
  });

  test('it should show a show more item when there are more fields to show', (done) => {
    const amountOfFieldsExpected = FIELDS_TO_SHOW;
    const mockDocWithTwentyFields = {};
    for (let i = 0; i < 20; i++) {
      mockDocWithTwentyFields[`${i}`] = 'some value';
    }
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {
        find: (ns, filter, options, callback): void => {
          callback(null, [mockDocWithTwentyFields]);
        }
      },
      true,
      false,
      null
    );

    testSchemaTreeItem
      .getChildren()
      .then((schemaFields) => {
        assert(FIELDS_TO_SHOW === 15, 'Expeted FIELDS_TO_SHOW to be 15');

        assert(
          schemaFields.length === amountOfFieldsExpected + 1,
          `Expected ${amountOfFieldsExpected +
          1} documents to be returned, found ${schemaFields.length}`
        );
        assert(
          schemaFields[amountOfFieldsExpected].label === 'Show more fields...',
          `Expected a tree item child with the label "Show more fields..." found ${schemaFields[amountOfFieldsExpected].label}`
        );
      })
      .then(done, done);
  });

  test('it should show more fields after the show more click handler is called', (done) => {
    const mockDocWithThirtyFields = {};
    for (let i = 0; i < 30; i++) {
      mockDocWithThirtyFields[`${i}`] = 'some value';
    }
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {
        find: (ns, filter, options, callback): void => {
          callback(null, [mockDocWithThirtyFields]);
        }
      },
      true,
      false,
      null
    );

    testSchemaTreeItem.onShowMoreClicked();

    testSchemaTreeItem
      .getChildren()
      .then((schemaFields) => {
        const amountOfFieldsExpected = 30;

        assert(
          schemaFields.length === amountOfFieldsExpected,
          `Expected ${amountOfFieldsExpected} documents to be returned, found ${schemaFields.length}`
        );
      })
      .then(done, done);
  });

  test('When schema parsing fails it displays an error message', (done) => {
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

    testSchemaTreeItem
      .getChildren()
      .then((schemaFields) => {
        assert(schemaFields.length === 0);
        assert(fakeVscodeErrorMessage.called);
        const expectedMessage =
          'Unable to parse schema: Unknown input type for `docs`. Must be an array, stream or MongoDB Cursor.';
        assert(
          fakeVscodeErrorMessage.firstArg === expectedMessage,
          `Expected error message to be "${expectedMessage}" found "${fakeVscodeErrorMessage.firstArg}"`
        );
      })
      .then(done, done);
  });

  suite('Live Database Tests', () => {
    afterEach(async () => {
      await cleanupTestDB();
    });

    test('when not expanded it has not yet pulled the schema', (done) => {
      seedDataAndCreateDataService('favoritePiesIWantToEatRightNow', [
        {
          _id: 10,
          someField: 'applePie'
        }
      ]).then((dataService) => {
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
          .then((schemaFields) => {
            dataService.disconnect();

            assert(
              schemaFields.length === 0,
              `Expected no schema tree items to be returned, recieved ${schemaFields.length}`
            );
          })
          .then(done, done);
      });
    });

    test('when expanded shows the fields of a schema', (done) => {
      seedDataAndCreateDataService('favoritePiesIWantToEatRightNow', [
        {
          _id: 1,
          nameOfTastyPie: 'applePie'
        }
      ]).then((dataService) => {
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
          })
          .then(done, done);
      });
    });

    test('it only shows a dropdown for fields which are always documents - and not for polymorphic', (done) => {
      seedDataAndCreateDataService('favoritePiesIWantToEatRightNow', [
        {
          _id: 1,
          alwaysDocument: {
            fieldName: 'nice'
          },
          notAlwaysADocument: {
            sureImADocument: 'hmmmm'
          }
        },
        {
          _id: 2,
          alwaysDocument: {
            fieldName: 'nice'
          },
          notAlwaysADocument: 'A spy!'
        }
      ]).then((dataService) => {
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
          })
          .then(done, done);
      });
    });
  });
});
