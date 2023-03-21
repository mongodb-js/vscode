import * as vscode from 'vscode';
import sinon from 'sinon';
import { after, afterEach, before } from 'mocha';
import assert from 'assert';
import { inspect } from 'util';
import type { DataService } from 'mongodb-data-service';
import type { Document } from 'mongodb';

import { ext } from '../../../extensionConstants';
import { fieldIsExpandable } from '../../../explorer/fieldTreeItem';
import {
  createTestDataService,
  seedTestDB,
  cleanupTestDB,
  disconnectFromTestDB,
  TEST_DB_NAME,
  TEST_DATABASE_URI,
} from '../dbTestHelper';
import SchemaTreeItem, {
  FIELDS_TO_SHOW,
} from '../../../explorer/schemaTreeItem';
import { ExtensionContextStub } from '../stubs';

import { contributes } from '../../../../package.json';

suite('SchemaTreeItem Test Suite', function () {
  this.timeout(10000);
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('its context value should be in the package json', () => {
    let schemaRegisteredCommandInPackageJson = false;
    const testSchemaTreeItem = new SchemaTreeItem(
      'cheesePizza',
      TEST_DB_NAME,
      {} as DataService,
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
      {} as DataService,
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
    const expectedMessage =
      'No documents were found when attempting to parse schema.';

    const findStub = sandbox.stub();
    findStub.resolves([]);
    const testDataService = {
      find: findStub,
    } as Pick<DataService, 'find'> as unknown as DataService;

    const testSchemaTreeItem = new SchemaTreeItem(
      'peanutButter',
      TEST_DB_NAME,
      testDataService,
      true,
      false,
      false,
      false,
      {}
    );

    const showInformationMessageStub = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );

    const schemaFields = await testSchemaTreeItem.getChildren();

    assert(
      schemaFields.length === 0,
      `Expected ${0} documents to be returned, found ${schemaFields.length}`
    );

    assert(
      showInformationMessageStub.firstCall.args[0] === expectedMessage,
      `Expected message to be '${expectedMessage}' found ${showInformationMessageStub.firstCall.args[0]}`
    );
  });

  test('it should show a show more item when there are more fields to show', async () => {
    const amountOfFieldsExpected = FIELDS_TO_SHOW;
    const mockDocWithTwentyFields = {};
    for (let i = 0; i < 20; i++) {
      mockDocWithTwentyFields[`${i}`] = 'some value';
    }
    const findStub = sandbox.stub();
    findStub.resolves([mockDocWithTwentyFields]);
    const testDataService = {
      find: findStub,
    } as Pick<DataService, 'find'> as unknown as DataService;
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      testDataService,
      true,
      false,
      false,
      false,
      {}
    );

    const schemaFields = await testSchemaTreeItem.getChildren();
    assert.strictEqual(FIELDS_TO_SHOW, 15, 'Expeted FIELDS_TO_SHOW to be 15');

    assert.strictEqual(
      schemaFields.length,
      amountOfFieldsExpected + 1,
      `Expected ${amountOfFieldsExpected + 1} documents to be returned, found ${
        schemaFields.length
      }`
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
    const findStub = sandbox.stub();
    findStub.resolves([mockDocWithThirtyFields]);
    const testDataService = {
      find: findStub,
    } as Pick<DataService, 'find'> as unknown as DataService;
    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      testDataService,
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
    const findStub = sandbox.stub();
    findStub.resolves('invalid schema to parse' as unknown as Document[]);
    const testDataService = {
      find: findStub,
    } as Pick<DataService, 'find'> as unknown as DataService;

    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      testDataService,
      true,
      false,
      false,
      false,
      {}
    );

    try {
      await testSchemaTreeItem.getChildren();
      assert(false, 'Didnt expect to succeed.');
    } catch (error) {
      const expectedMessage =
        "Unable to parse schema: Cannot use 'in' operator to search for 'stream' in invalid schema to parse";

      assert.strictEqual(
        (<any>error).message,
        expectedMessage,
        `Expected error message to be "${expectedMessage}" found "${
          (<any>error).message
        }"`
      );
    }
  });

  suite('Live Database Tests', () => {
    this.timeout(5000);
    let dataService;

    before(async () => {
      dataService = await createTestDataService(TEST_DATABASE_URI);
    });

    afterEach(async () => {
      await cleanupTestDB();
    });

    after(async () => {
      await disconnectFromTestDB();
    });

    test('when not expanded it has not yet pulled the schema', async () => {
      await seedTestDB('favoritePiesIWantToEatRightNow', [
        {
          _id: 10,
          someField: 'applePie',
        },
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

      assert(
        schemaFields.length === 0,
        `Expected no schema tree items to be returned, recieved ${schemaFields.length}`
      );
    });

    test('when expanded shows the fields of a schema', async () => {
      await seedTestDB('favoritePiesIWantToEatRightNow', [
        {
          _id: 1,
          nameOfTastyPie: 'applePie',
        },
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

      await testSchemaTreeItem.onDidExpand();

      const schemaFields = await testSchemaTreeItem.getChildren();

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
      await seedTestDB('favoritePiesIWantToEatRightNow', [
        {
          _id: 1,
          alwaysDocument: {
            fieldName: 'nice',
          },
          notAlwaysADocument: {
            sureImADocument: 'hmmmm',
          },
        },
        {
          _id: 2,
          alwaysDocument: {
            fieldName: 'nice',
          },
          notAlwaysADocument: 'A spy!',
        },
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

      await testSchemaTreeItem.onDidExpand();

      const schemaFields = await testSchemaTreeItem.getChildren();

      assert(
        schemaFields.length === 3,
        `Expected 3 schema tree items to be returned, recieved ${
          schemaFields.length
        }: ${inspect(schemaFields)}`
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
    ext.context = new ExtensionContextStub();

    const testSchemaTreeItem = new SchemaTreeItem(
      'favoritePiesIWantToEatRightNow',
      TEST_DB_NAME,
      {} as DataService,
      false,
      false,
      false,
      false,
      {}
    );

    const schemaIconPath = testSchemaTreeItem.iconPath;
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
