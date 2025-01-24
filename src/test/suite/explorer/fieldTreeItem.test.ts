import { after, afterEach, before } from 'mocha';
import assert from 'assert';
import type { DataService } from 'mongodb-data-service';

import { ext } from '../../../extensionConstants';
import FieldTreeItem, {
  FIELD_TREE_ITEM_CONTEXT_VALUE,
  fieldIsExpandable,
  getIconFileNameForField,
} from '../../../explorer/fieldTreeItem';
import {
  createTestDataService,
  seedTestDB,
  cleanupTestDB,
  disconnectFromTestDB,
  TEST_DB_NAME,
  TEST_DATABASE_URI,
} from '../dbTestHelper';
import SchemaTreeItem from '../../../explorer/schemaTreeItem';
import { ExtensionContextStub } from '../stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../../../package.json');

function getTestFieldTreeItem(
  options?: Partial<ConstructorParameters<typeof FieldTreeItem>[0]>
): FieldTreeItem {
  return new FieldTreeItem({
    field: {
      name: 'test',
      probability: 1,
      type: 'String',
      types: [],
    },
    isExpanded: false,
    existingCache: {},
    ...options,
  });
}

function getTestSchemaTreeItem(
  options?: Partial<ConstructorParameters<typeof SchemaTreeItem>[0]>
) {
  return new SchemaTreeItem({
    databaseName: 'zebraWearwolf',
    collectionName: 'giraffeVampire',
    dataService: {} as DataService,
    isExpanded: false,
    hasClickedShowMoreFields: false,
    hasMoreFieldsToShow: false,
    cacheIsUpToDate: false,
    childrenCache: {},
    ...options,
  });
}

suite('FieldTreeItem Test Suite', function () {
  this.timeout(10000);
  test('its context value should be in the package json', function () {
    let registeredCommandInPackageJson = false;

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(FIELD_TREE_ITEM_CONTEXT_VALUE)) {
        registeredCommandInPackageJson = true;
      }
    });

    assert(
      registeredCommandInPackageJson,
      'Expected field tree item to be registered with a command in package json'
    );
  });

  test('it should have a different icon depending on the field type', () => {
    ext.context = new ExtensionContextStub();

    const stringField = getTestFieldTreeItem();

    const iconPath = stringField.iconPath as { light: string; dark: string };
    assert(iconPath.dark.includes('string.svg'));
    assert(iconPath.light.includes('string.svg'));

    const numberField = getTestFieldTreeItem({
      field: {
        name: 'test',
        probability: 1,
        type: 'Number',
        types: [],
      },
    });

    const numberIcon = numberField.iconPath as { light: string; dark: string };
    assert(numberIcon.dark.includes('number.svg'));
    assert(numberIcon.light.includes('number.svg'));
  });

  test('getIconFileNameForField should return "mixed-type" for a polymorphic type field', () => {
    const notFullProbability = {
      name: 'test',
      probability: 1,
      types: [
        {
          name: 'a',
          probability: 0.5,
          bsonType: 'String',
        },
        {
          name: 'b',
          probability: 0.5,
          bsonType: 'Number',
        },
      ],
    };
    assert.strictEqual(
      getIconFileNameForField(notFullProbability),
      'mixed-type'
    );
  });

  test('getIconFileNameForField should return "mixed-type" for a field without 1 probability', () => {
    const notFullProbability = {
      name: 'test',
      probability: 0.5,
      types: [
        {
          name: 'a',
          probability: 1,
          bsonType: 'String',
        },
      ],
    };
    assert.strictEqual(
      getIconFileNameForField(notFullProbability),
      'mixed-type'
    );
  });

  test('it should have the fieldtype in the tooltip', () => {
    const testField = getTestFieldTreeItem({
      field: {
        name: 'test',
        probability: 0.5,
        type: 'String',
        types: [
          {
            name: 'a',
            probability: 0.5,
            bsonType: 'String',
          },
          {
            name: 'b',
            probability: 0.5,
            bsonType: 'Number',
          },
        ],
      },
    });

    assert.strictEqual(testField.tooltip, 'test - mixed-type');
  });

  suite('Full database tests', () => {
    this.timeout(5000);
    let dataService;

    before(async () => {
      dataService = await createTestDataService(TEST_DATABASE_URI);
    });

    afterEach(async () => {
      await cleanupTestDB();
    });

    after(async () => {
      dataService = await disconnectFromTestDB();
    });

    test('field name is pulled from the name of a field', async () => {
      await seedTestDB('pie', [{ _id: 1, blueberryPie: 'yes' }]);
      const testSchemaTreeItem = getTestSchemaTreeItem({
        databaseName: TEST_DB_NAME,
        collectionName: 'pie',
        isExpanded: true,
        dataService,
      });
      const schemaFields = await testSchemaTreeItem.getChildren();

      assert.strictEqual(schemaFields[0].label, '_id');
      assert.strictEqual(schemaFields[1].label, 'blueberryPie');
      assert.strictEqual(schemaFields[1].fieldName, 'blueberryPie');
    });

    test('it shows dropdowns for nested subdocuments', async () => {
      await seedTestDB('gryffindor', [
        {
          _id: 1,
          alwaysDocument: {
            nestedSubDocument: {
              magic: true,
              harry: 'potter',
            },
          },
        },
        {
          _id: 2,
          alwaysDocument: {
            nestedSubDocument: {
              magic: true,
              hermione: 'granger',
            },
          },
        },
      ]);

      const testSchemaTreeItem = getTestSchemaTreeItem({
        databaseName: TEST_DB_NAME,
        collectionName: 'gryffindor',
        dataService,
      });

      await testSchemaTreeItem.onDidExpand();

      const schemaFields = await testSchemaTreeItem.getChildren();

      assert.strictEqual(schemaFields.length, 2);
      assert(
        !fieldIsExpandable(schemaFields[0].field),
        'Expected _id field not to have expandable state'
      );
      assert(
        fieldIsExpandable(schemaFields[1].field),
        'Expected field to have expandable state'
      );

      const subdocuments = await schemaFields[1].getChildren();

      assert.strictEqual(subdocuments.length, 1);
      assert(
        fieldIsExpandable(subdocuments[0].field),
        'Expected subdocument to be expandable'
      );

      const nestedSubDocument = await subdocuments[0].getChildren();

      assert.strictEqual(nestedSubDocument.length, 3);
    });

    test('it shows dropdowns for arrays', async () => {
      await seedTestDB('gryffindor', [
        {
          _id: 1,
          testingArray: ['okay', 'nice'],
        },
        {
          _id: 2,
          testingArray: ['dobby'],
        },
      ]);

      const testSchemaTreeItem = getTestSchemaTreeItem({
        databaseName: TEST_DB_NAME,
        collectionName: 'gryffindor',
        dataService,
      });

      await testSchemaTreeItem.onDidExpand();

      const schemaFields = await testSchemaTreeItem.getChildren();

      assert.strictEqual(schemaFields.length, 2);
      assert(
        fieldIsExpandable(schemaFields[1].field),
        'Expected field to have expandable state'
      );

      const arrayFieldContainer = await schemaFields[1].getChildren();

      assert.strictEqual(arrayFieldContainer.length, 1);
      assert(
        !fieldIsExpandable(arrayFieldContainer[0].field),
        'Expected array field container to not be expandable'
      );
    });

    test('it shows dropdowns and fields for document fields in arrays', async () => {
      await seedTestDB('beach', [
        {
          _id: 1,
          testingArray: [
            {
              color: 'orange',
              sunset: false,
            },
          ],
        },
        {
          _id: 2,
          testingArray: [
            {
              color: 'violet',
              sunset: true,
            },
          ],
        },
      ]);

      const testSchemaTreeItem = getTestSchemaTreeItem({
        databaseName: TEST_DB_NAME,
        collectionName: 'beach',
        dataService,
      });

      await testSchemaTreeItem.onDidExpand();

      const schemaFields = await testSchemaTreeItem.getChildren();

      const nestedSubDocuments = await schemaFields[1].getChildren();

      assert.strictEqual(nestedSubDocuments.length, 1);
      assert(
        fieldIsExpandable(nestedSubDocuments[0].field),
        'Expected subdocument in array to be expandable'
      );

      const subdocFields = await nestedSubDocuments[0].getChildren();

      assert.strictEqual(subdocFields.length, 2);
      assert.strictEqual(subdocFields[1].label, 'sunset');
      assert(
        !fieldIsExpandable(subdocFields[1].field),
        'Expected subdocument boolean field to not be expandable'
      );
    });
  });
});
