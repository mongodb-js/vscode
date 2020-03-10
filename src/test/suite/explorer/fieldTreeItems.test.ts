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
          schemaFields[1].getChildren().then(subdocuments => {
            assert(
              subdocuments.length === 1,
              `Expected subdocument to have 1 field found ${subdocuments.length}`
            );
            assert(
              fieldIsExpandable(subdocuments[0].field),
              'Expected subdocument to be expandable'
            );
            subdocuments[0].getChildren().then(nestedSubDocument => {
              assert(
                nestedSubDocument.length === 3,
                'Expected nested subdocument to have 3 fields'
              );
            }).then(done, done);
          }).catch(done);
        });
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
          schemaFields[1].getChildren().then(arrayFieldContainer => {
            assert(
              arrayFieldContainer.length === 1,
              `Expected array field to have 1 field found ${arrayFieldContainer.length}`
            );
            assert(
              fieldIsExpandable(arrayFieldContainer[0].field),
              'Expected array field container to be expandable'
            );
            arrayFieldContainer[0].getChildren().then(arrayFields => {
              assert(
                arrayFields.length === 1,
                `Expected array field fields to have 1 field found ${arrayFields.length}`
              );
              assert(
                !fieldIsExpandable(arrayFields[0].field),
                'Expected string field in array not to be expandable'
              );
            }).then(done, done);
          }).catch(done);
        });
    });
  });

  test('it shows dropdowns and fields for document fields in arrays', function (done) {
    seedDataAndCreateDataService(
      'beach',
      [{
        _id: 1,
        testingArray: [{
          color: 'orange',
          sunset: false
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

          schemaFields[1].getChildren().then(arrayFieldContainer => {
            assert(
              arrayFieldContainer.length === 1,
              `Expected array fields to have length 1 found ${arrayFieldContainer.length}`
            );
            arrayFieldContainer[0].getChildren().then(nestedSubDocuments => {
              assert(
                nestedSubDocuments.length === 1,
                `Expected array field fields to have 1 field found ${nestedSubDocuments.length}`
              );
              assert(
                fieldIsExpandable(nestedSubDocuments[0].field),
                'Expected subdocument in array to be expandable'
              );
              nestedSubDocuments[0].getChildren().then(subdocFields => {
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
    });
  });
});
