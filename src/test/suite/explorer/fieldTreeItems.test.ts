import * as assert from 'assert';
import { afterEach } from 'mocha';

import {
  seedDataAndCreateDataService,
  cleanupTestDB,
  TEST_DB_NAME
} from '../dbTestHelper';
import { fieldIsExpandable } from '../../../explorer/fieldTreeItem';
import SchemaTreeItem from '../../../explorer/schemaTreeItem';

suite('FieldTreeItem Test Suite', () => {
  afterEach(async () => {
    await cleanupTestDB();
  });

  test('field name is pulled from the name of a field', function (done) {
    seedDataAndCreateDataService(
      'pie',
      [{
        _id: 1,
        blueberryPie: 'yes'
      }]
    ).then(dataService => {
      const testSchemaTreeItem = new SchemaTreeItem(
        'pie',
        TEST_DB_NAME,
        dataService,
        true,
        false,
        null
      );

      testSchemaTreeItem
        .getChildren()
        .then((schemaFields) => {
          dataService.disconnect();

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
        }).then(done, done);
    });
  });

  test('it shows dropdowns for nested subdocuments', function (done) {
    seedDataAndCreateDataService(
      'gryffindor',
      [{
        _id: 1,
        alwaysDocument: {
          nestedSubDocument: {
            magic: true,
            harry: 'potter'
          }
        }
      }, {
        _id: 2,
        alwaysDocument: {
          nestedSubDocument: {
            magic: true,
            hermione: 'granger'
          }
        }
      }]
    ).then(dataService => {
      const testSchemaTreeItem = new SchemaTreeItem(
        'gryffindor',
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
          console.log('first fields', schemaFields);
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
          console.log('subdocument field ', schemaFields[1].field);
          const subdocument = schemaFields[1].getChildren();
          console.log('subdocument', subdocument);
          assert(
            subdocument.length === 1,
            `Expected subdocument to have 1 field found ${subdocument.length}`
          );
          assert(
            fieldIsExpandable(subdocument.field),
            'Expected subdocument to be expandable'
          );
          const nestedSubDocument = subdocument.getChildren();
          assert(
            nestedSubDocument.length === 3,
            'Expected nested subdocument to have 3 fields'
          );
        }).then(done, done);
    });
  });

  test('it shows dropdowns for arrays', function (done) {
    seedDataAndCreateDataService(
      'gryffindor',
      [{
        _id: 1,
        testingArray: ['okay', 'nice']
      }, {
        _id: 2,
        testingArray: ['dobby']
      }]
    ).then(dataService => {
      const testSchemaTreeItem = new SchemaTreeItem(
        'gryffindor',
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
            fieldIsExpandable(schemaFields[1].field),
            'Expected field to have expandable state'
          );
          const arrayFieldContainer = schemaFields[1].getChildren();
          assert(
            arrayFieldContainer.length === 1,
            `Expected array field to have 1 field found ${arrayFieldContainer.length}`
          );
          assert(
            fieldIsExpandable(arrayFieldContainer.field),
            'Expected array field container to be expandable'
          );
          const arrayField = arrayFieldContainer.getChildren();
          assert(
            arrayField.length === 1,
            `Expected array field fields to have 1 field found ${arrayField.length}`
          );
          assert(
            !fieldIsExpandable(arrayField.field),
            'Expected string field in array not to be expandable'
          );
        }).then(done, done);
    });
  });

  test('it shows dropdowns and fields for document fields in arrays', function (done) {
    seedDataAndCreateDataService(
      'beach',
      [{
        _id: 1,
        testingArray: [{
          color: 'orange',
          sunset: true
        }]
      }, {
        _id: 2,
        testingArray: [{
          color: 'violet',
          sunset: true
        }]
      }]
    ).then(dataService => {
      const testSchemaTreeItem = new SchemaTreeItem(
        'beach',
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

          console.log('schemaFields[1]', schemaFields[1]);
          const arrayFieldContainer = schemaFields[1].getChildren();
          console.log('arrayFieldContainer', arrayFieldContainer);
          assert(
            arrayFieldContainer.length === 1,
            `Expected array fields to have length 1 found ${arrayFieldContainer.length}`
          );
          const nestedSubDocument = arrayFieldContainer.getChildren();
          assert(
            nestedSubDocument.length === 1,
            `Expected array field fields to have 1 field found ${nestedSubDocument.length}`
          );
          const subdocFields = nestedSubDocument.getChildren();
          assert(
            fieldIsExpandable(subdocFields.field),
            'Expected subdocument in array to be expandable'
          );
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
        }).then(done, done);
    });
  });
});
