import { after, afterEach, before } from 'mocha';
import assert from 'assert';

import { ext } from '../../../extensionConstants';
import FieldTreeItem, {
  FIELD_TREE_ITEM_CONTEXT_VALUE,
  fieldIsExpandable,
  getIconFileNameForField
} from '../../../explorer/fieldTreeItem';
import {
  createTestDataService,
  seedTestDB,
  cleanupTestDB,
  disconnectFromTestDB,
  TEST_DB_NAME
} from '../dbTestHelper';
import SchemaTreeItem from '../../../explorer/schemaTreeItem';
import { TestExtensionContext } from '../stubs';

const { contributes } = require('../../../../package.json');

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
    ext.context = new TestExtensionContext();

    const stringField = new FieldTreeItem(
      {
        name: 'test',
        probability: 1,
        type: 'String',
        types: []
      },
      false,
      {}
    );

    const iconPath: any = stringField.iconPath;
    assert(iconPath.dark.includes('string.svg'));
    assert(iconPath.light.includes('string.svg'));

    const numberField = new FieldTreeItem(
      {
        name: 'test',
        probability: 1,
        type: 'Number',
        types: []
      },
      false,
      {}
    );

    const numberIcon: any = numberField.iconPath;
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
          bsonType: 'String'
        },
        {
          name: 'b',
          probability: 0.5,
          bsonType: 'Number'
        }
      ]
    };
    assert(getIconFileNameForField(notFullProbability) === 'mixed-type');
  });

  test('getIconFileNameForField should return "mixed-type" for a field without 1 probability', () => {
    const notFullProbability = {
      name: 'test',
      probability: 0.5,
      types: [
        {
          name: 'a',
          probability: 1,
          bsonType: 'String'
        }
      ]
    };
    assert(getIconFileNameForField(notFullProbability) === 'mixed-type');
  });

  test('it should have the fieldtype in the tooltip', () => {
    const testField = new FieldTreeItem(
      {
        name: 'test',
        probability: 0.5,
        type: 'String',
        types: [
          {
            name: 'a',
            probability: 0.5,
            bsonType: 'String'
          },
          {
            name: 'b',
            probability: 0.5,
            bsonType: 'Number'
          }
        ]
      },
      false,
      {}
    );

    const tooltipMatches = testField.tooltip === 'test - mixed-type';
    assert(tooltipMatches, `Expected tooltip '${testField.tooltip}' to equal 'test - mixed-type'`);
  });

  suite('Full database tests', () => {
    this.timeout(5000);
    let dataService;

    before(async () => {
      dataService = await createTestDataService();
    });

    afterEach(async () => {
      await cleanupTestDB();
    });

    after(async () => {
      dataService = await disconnectFromTestDB();
    });

    test('field name is pulled from the name of a field', async () => {
      await seedTestDB(
        'pie',
        [{ _id: 1, blueberryPie: 'yes' }]
      );
      const testSchemaTreeItem = new SchemaTreeItem(
        'pie',
        TEST_DB_NAME,
        dataService,
        true,
        false,
        false,
        false,
        {}
      );
      const schemaFields = await testSchemaTreeItem.getChildren();

      assert(
        schemaFields[0].label === '_id',
        `Expected field name to be "_id" recieved ${schemaFields[0].label}`
      );
      assert(
        schemaFields[1].label === 'blueberryPie',
        `Expected field name to be "blueberryPie" recieved ${schemaFields[0].label}`
      );
      assert(
        schemaFields[1].fieldName === 'blueberryPie',
        `Expected field name to be "blueberryPie" recieved ${schemaFields[0].label}`
      );
    });

    test('it shows dropdowns for nested subdocuments', async () => {
      await seedTestDB(
        'gryffindor',
        [
          {
            _id: 1,
            alwaysDocument: {
              nestedSubDocument: {
                magic: true,
                harry: 'potter'
              }
            }
          },
          {
            _id: 2,
            alwaysDocument: {
              nestedSubDocument: {
                magic: true,
                hermione: 'granger'
              }
            }
          }
        ]
      );

      const testSchemaTreeItem = new SchemaTreeItem(
        'gryffindor',
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
        !fieldIsExpandable(schemaFields[0].field),
        'Expected _id field not to have expandable state'
      );
      assert(
        fieldIsExpandable(schemaFields[1].field),
        'Expected field to have expandable state'
      );

      const subdocuments = await schemaFields[1].getChildren();

      assert(
        subdocuments.length === 1,
        `Expected subdocument to have 1 field found ${subdocuments.length}`
      );
      assert(
        fieldIsExpandable(subdocuments[0].field),
        'Expected subdocument to be expandable'
      );

      const nestedSubDocument = await subdocuments[0].getChildren();

      assert(
        nestedSubDocument.length === 3,
        'Expected nested subdocument to have 3 fields'
      );
    });

    test('it shows dropdowns for arrays', async () => {
      await seedTestDB(
        'gryffindor',
        [
          {
            _id: 1,
            testingArray: ['okay', 'nice']
          },
          {
            _id: 2,
            testingArray: ['dobby']
          }
        ]
      );

      const testSchemaTreeItem = new SchemaTreeItem(
        'gryffindor',
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
        fieldIsExpandable(schemaFields[1].field),
        'Expected field to have expandable state'
      );

      const arrayFieldContainer = await schemaFields[1].getChildren();

      assert(
        arrayFieldContainer.length === 1,
        `Expected array field to have 1 field found ${arrayFieldContainer.length}`
      );
      assert(
        !fieldIsExpandable(arrayFieldContainer[0].field),
        'Expected array field container to not be expandable'
      );
    });

    test('it shows dropdowns and fields for document fields in arrays', async () => {
      await seedTestDB(
        'beach',
        [
          {
            _id: 1,
            testingArray: [
              {
                color: 'orange',
                sunset: false
              }
            ]
          },
          {
            _id: 2,
            testingArray: [
              {
                color: 'violet',
                sunset: true
              }
            ]
          }
        ]
      );

      const testSchemaTreeItem = new SchemaTreeItem(
        'beach',
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

      const nestedSubDocuments = await schemaFields[1].getChildren();

      assert(
        nestedSubDocuments.length === 1,
        `Expected array field fields to have 1 field found ${nestedSubDocuments.length}`
      );
      assert(
        fieldIsExpandable(nestedSubDocuments[0].field),
        'Expected subdocument in array to be expandable'
      );

      const subdocFields = await nestedSubDocuments[0].getChildren();

      assert(
        subdocFields.length === 2,
        `Expected subdocument in array field to have 2 fields found ${subdocFields.length}`
      );
      assert(
        subdocFields[1].label === 'sunset',
        'Expected subdocument field to have correct label'
      );
      assert(
        !fieldIsExpandable(subdocFields[1].field),
        'Expected subdocument boolean field to not be expandable'
      );
    });
  });
});
