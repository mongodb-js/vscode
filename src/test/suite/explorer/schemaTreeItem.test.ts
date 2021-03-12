import assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';
import { inspect } from 'util';

const { contributes } = require('../../../../package.json');

import SchemaTreeItem, {
  FIELDS_TO_SHOW
} from '../../../explorer/schemaTreeItem';
import { fieldIsExpandable } from '../../../explorer/fieldTreeItem';
import { ext } from '../../../extensionConstants';

import {
  seedDataAndCreateDataService,
  cleanupTestDB,
  TEST_DB_NAME
} from '../dbTestHelper';
import { TestExtensionContext } from '../stubs';

suite('SchemaTreeItem Test Suite', function () {
  this.timeout(10000);
  afterEach(() => {
    sinon.restore();
  });

  test('its context value should be in the package json', () => {
    let schemaRegisteredCommandInPackageJson = false;
    const testSchemaTreeItem = new SchemaTreeItem(
      'cheesePizza',
      TEST_DB_NAME,
      {} as any,
      false,
      false,
      false,
      false,
      {}
    );

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testSchemaTreeItem.contextValue)) {
        schemaRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      schemaRegisteredCommandInPackageJson,
      'Expected schema tree item to be registered with a command in package json'
    );
  });

  test('when the "show more" click handler function is called it sets the schema to show more fields', () => {
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {} as any,
      false,
      false,
      false,
      false,
      {}
    );

    assert(
      !testSchemaTreeItem.hasClickedShowMoreFields,
      'Expected "hasClickedShowMoreFields" to be false by default'
    );
    testSchemaTreeItem.cacheIsUpToDate = true;

    testSchemaTreeItem.onShowMoreClicked();

    assert(
      !testSchemaTreeItem.cacheIsUpToDate,
      'Expected `cacheIsUpToDate` to be reset to false'
    );
    assert(
      testSchemaTreeItem.hasClickedShowMoreFields,
      'Expected "hasClickedShowMoreFields" to be set to true'
    );
  });

  test('when there are no documents in the schema it should show a message', async () => {
    const expectedMessage = 'No documents were found when attempting to parse schema.';

    const testSchemaTreeItem = new SchemaTreeItem(
      'peanutButter',
      TEST_DB_NAME,
      {
        db: () => ({
          collection: () => ({
            find: () => ({
              limit: () => ({
                toArray: () => ([])
              })
            })
          })
        })
      } as any,
      true,
      false,
      false,
      false,
      {}
    );

    const fakeShowInformationMessage = sinon.stub(
      vscode.window,
      'showInformationMessage'
    );

    const schemaFields = await testSchemaTreeItem.getChildren();

    assert(
      schemaFields.length === 0,
      `Expected ${0} documents to be returned, found ${schemaFields.length}`
    );

    assert(
      fakeShowInformationMessage.firstCall.args[0] === expectedMessage,
      `Expected message to be '${expectedMessage}' found ${fakeShowInformationMessage.firstCall.args[0]}`
    );
  });

  test('it should show a show more item when there are more fields to show', async () => {
    const amountOfFieldsExpected = FIELDS_TO_SHOW;
    const mockDocWithTwentyFields = {};
    for (let i = 0; i < 20; i++) {
      mockDocWithTwentyFields[`${i}`] = 'some value';
    }
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {
        db: () => ({
          collection: () => ({
            find: () => ({
              limit: () => ({
                toArray: () => ([mockDocWithTwentyFields])
              })
            })
          })
        })
      } as any,
      true,
      false,
      false,
      false,
      {}
    );

    const schemaFields = await testSchemaTreeItem.getChildren();
    assert(FIELDS_TO_SHOW === 15, 'Expeted FIELDS_TO_SHOW to be 15');

    assert(
      schemaFields.length === amountOfFieldsExpected + 1,
      `Expected ${amountOfFieldsExpected + 1
      } documents to be returned, found ${schemaFields.length}`
    );
    assert(
      schemaFields[amountOfFieldsExpected].label === 'Show more fields...',
      `Expected a tree item child with the label "Show more fields..." found ${schemaFields[amountOfFieldsExpected].label}`
    );
  });

  test('it should show more fields after the show more click handler is called', async () => {
    const mockDocWithThirtyFields = {};
    for (let i = 0; i < 30; i++) {
      mockDocWithThirtyFields[`${i}`] = 'some value';
    }
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {
        db: () => ({
          collection: () => ({
            find: () => ({
              limit: () => ({
                toArray: () => ([mockDocWithThirtyFields])
              })
            })
          })
        })
      } as any,
      true,
      false,
      false,
      false,
      {}
    );

    testSchemaTreeItem.onShowMoreClicked();

    const schemaFields = await testSchemaTreeItem.getChildren();
    const amountOfFieldsExpected = 30;

    assert(
      schemaFields.length === amountOfFieldsExpected,
      `Expected ${amountOfFieldsExpected} documents to be returned, found ${schemaFields.length}`
    );
  });

  test('When schema parsing fails it displays an error message', async () => {
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {
        db: () => ({
          collection: () => ({
            find: () => ({
              limit: () => ({
                toArray: () => ('invalid schema to parse')
              })
            })
          })
        })
      } as any,
      true,
      false,
      false,
      false,
      {}
    );

    try {
      await testSchemaTreeItem.getChildren();
      assert(false, 'Didnt expect to succeed.');
    } catch (err) {
      const expectedMessage =
        'Unable to parse schema: Unknown input type for `docs`. Must be an array, stream or MongoDB Cursor.';

      assert(
        err.message === expectedMessage,
        `Expected error message to be "${expectedMessage}" found "${err.message}"`
      );
    }
  });

  suite('Live Database Tests', () => {
    afterEach(async () => {
      await cleanupTestDB();
    });

    test('when not expanded it has not yet pulled the schema', async () => {
      const dataService = await seedDataAndCreateDataService('favoritePiesIWantToEatRightNow', [
        {
          _id: 10,
          someField: 'applePie'
        }
      ]);
      const testSchemaTreeItem = new SchemaTreeItem(
        'favoritePiesIWantToEatRightNow',
        TEST_DB_NAME,
        dataService,
        false,
        false,
        false,
        false,
        {}
      );

      const schemaFields = await testSchemaTreeItem.getChildren();
      dataService.close();

      assert(
        schemaFields.length === 0,
        `Expected no schema tree items to be returned, recieved ${schemaFields.length}`
      );
    });

    test('when expanded shows the fields of a schema', async () => {
      const dataService = await seedDataAndCreateDataService('favoritePiesIWantToEatRightNow', [
        {
          _id: 1,
          nameOfTastyPie: 'applePie'
        }
      ]);
      const testSchemaTreeItem = new SchemaTreeItem(
        'favoritePiesIWantToEatRightNow',
        TEST_DB_NAME,
        dataService,
        false,
        false,
        false,
        false,
        {}
      );

      testSchemaTreeItem.onDidExpand();

      const schemaFields: vscode.TreeItem[] = await testSchemaTreeItem.getChildren();
      dataService.close();
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
    });

    test('it only shows a dropdown for fields which are always documents - and not for polymorphic', async () => {
      const dataService = await seedDataAndCreateDataService('favoritePiesIWantToEatRightNow', [
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
      ]);
      const testSchemaTreeItem = new SchemaTreeItem(
        'favoritePiesIWantToEatRightNow',
        TEST_DB_NAME,
        dataService,
        false,
        false,
        false,
        false,
        {}
      );

      testSchemaTreeItem.onDidExpand();

      const schemaFields = await testSchemaTreeItem.getChildren();
      dataService.close();
      assert(
        schemaFields.length === 3,
        `Expected 3 schema tree items to be returned, recieved ${schemaFields.length}: ${inspect(schemaFields)}`
      );
      assert(
        fieldIsExpandable(schemaFields[1].field),
        'Expected field to have expandable state'
      );
      assert(
        fieldIsExpandable(schemaFields[2].field) === false,
        'Expected field to have none expandable state'
      );
    });
  });

  test('it should have an icon with the name schema', () => {
    ext.context = new TestExtensionContext();

    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {} as any,
      false,
      false,
      false,
      false,
      {}
    );

    const schemaIconPath: any = testSchemaTreeItem.iconPath;
    assert(
      schemaIconPath.light.includes('schema.svg'),
      'Expected icon path to point to an svg by the name "schema" with a light mode'
    );
    assert(
      schemaIconPath.dark.includes('schema.svg'),
      'Expected icon path to point to an svg by the name "schema" with a light mode'
    );
  });
});
