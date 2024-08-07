import * as vscode from 'vscode';
import sinon from 'sinon';
import { after, afterEach, before } from 'mocha';
import assert from 'assert';
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../../../package.json');

function getTestSchemaTreeItem(
  options?: Partial<ConstructorParameters<typeof SchemaTreeItem>[0]>
) {
  return new SchemaTreeItem({
    databaseName: TEST_DB_NAME,
    collectionName: 'cheesePizza',
    dataService: {} as DataService,
    isExpanded: false,
    hasClickedShowMoreFields: false,
    hasMoreFieldsToShow: false,
    cacheIsUpToDate: false,
    childrenCache: {},
    ...options,
  });
}

suite('SchemaTreeItem Test Suite', function () {
  this.timeout(10000);
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('its context value should be in the package json', () => {
    let schemaRegisteredCommandInPackageJson = false;
    const testSchemaTreeItem = getTestSchemaTreeItem();

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
    const testSchemaTreeItem = getTestSchemaTreeItem();

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
    } as unknown as DataService;

    const testSchemaTreeItem = getTestSchemaTreeItem({
      dataService: testDataService,
      isExpanded: true,
    });

    const showInformationMessageStub = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );

    const schemaFields = await testSchemaTreeItem.getChildren();

    assert.strictEqual(schemaFields.length, 0);
    assert.strictEqual(
      showInformationMessageStub.firstCall.args[0],
      expectedMessage
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
    } as unknown as DataService;
    const testSchemaTreeItem = getTestSchemaTreeItem({
      dataService: testDataService,
      isExpanded: true,
    });

    const schemaFields = await testSchemaTreeItem.getChildren();
    assert.strictEqual(FIELDS_TO_SHOW, 15, 'Expeted FIELDS_TO_SHOW to be 15');

    assert.strictEqual(
      schemaFields.length,
      amountOfFieldsExpected + 1,
      `Expected ${amountOfFieldsExpected + 1} documents to be returned, found ${
        schemaFields.length
      }`
    );
    assert.strictEqual(
      schemaFields[amountOfFieldsExpected].label,
      'Show more fields...'
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
    } as unknown as DataService;
    const testSchemaTreeItem = getTestSchemaTreeItem({
      dataService: testDataService,
      isExpanded: true,
    });

    testSchemaTreeItem.onShowMoreClicked();

    const schemaFields = await testSchemaTreeItem.getChildren();
    const amountOfFieldsExpected = 30;

    assert.strictEqual(schemaFields.length, amountOfFieldsExpected);
  });

  test('When schema parsing fails it displays an error message', async () => {
    const findStub = sandbox.stub();
    findStub.resolves('invalid schema to parse' as unknown as Document[]);
    const testDataService = {
      find: findStub,
    } as unknown as DataService;

    const testSchemaTreeItem = getTestSchemaTreeItem({
      dataService: testDataService,
      isExpanded: true,
    });

    try {
      await testSchemaTreeItem.getChildren();
      assert(false, 'Didnt expect to succeed.');
    } catch (error) {
      const expectedMessage =
        "Unable to parse schema: Cannot use 'in' operator to search for 'Symbol(Symbol.iterator)' in invalid schema to parse";

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
      await seedTestDB('pizza', [
        {
          _id: 10,
          someField: 'applePie',
        },
      ]);

      const testSchemaTreeItem = getTestSchemaTreeItem({
        collectionName: 'pizza',
        dataService,
      });

      const schemaFields = await testSchemaTreeItem.getChildren();

      assert.strictEqual(schemaFields.length, 0);
    });

    test('when expanded shows the fields of a schema', async () => {
      await seedTestDB('pizza', [
        {
          _id: 1,
          nameOfTastyPie: 'applePie',
        },
      ]);
      const testSchemaTreeItem = getTestSchemaTreeItem({
        collectionName: 'pizza',
        dataService,
      });

      await testSchemaTreeItem.onDidExpand();

      const schemaFields = await testSchemaTreeItem.getChildren();

      assert.strictEqual(schemaFields.length, 2);
      assert.strictEqual(schemaFields[0].label, '_id');
      assert.strictEqual(schemaFields[1].label, 'nameOfTastyPie');
    });

    test('it only shows a dropdown for fields which are always documents - and not for polymorphic', async () => {
      await seedTestDB('pizza', [
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

      const testSchemaTreeItem = getTestSchemaTreeItem({
        collectionName: 'pizza',
        dataService,
      });

      await testSchemaTreeItem.onDidExpand();

      const schemaFields = await testSchemaTreeItem.getChildren();

      assert.strictEqual(schemaFields.length, 3);
      assert(
        fieldIsExpandable(schemaFields[1].field),
        'Expected field to have expandable state'
      );
      assert.strictEqual(fieldIsExpandable(schemaFields[2].field), false);
    });
  });

  test('it should have an icon with the name schema', () => {
    ext.context = new ExtensionContextStub();
    const testSchemaTreeItem = getTestSchemaTreeItem();

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
