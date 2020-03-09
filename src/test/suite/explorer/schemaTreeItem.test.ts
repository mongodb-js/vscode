import * as assert from 'assert';
import path = require('path');
import { afterEach } from 'mocha';

import SchemaTreeItem from '../../../explorer/schemaTreeItem';
import { fieldIsExpandable } from '../../../explorer/fieldTreeItem';
import {
  seedDataAndCreateDataService,
  cleanup,
  TEST_DB_NAME
} from '../dbTestHelper';

const { contributes } = require(path.resolve(__dirname, '../../../../package.json'));

suite('SchemaTreeItem Test Suite', () => {
  test('its context value should be in the package json', function () {
    let schemaRegisteredCommandInPackageJson = false;

    contributes.menus['view/item/context'].forEach(contextItem => {
      if (contextItem.when.includes(SchemaTreeItem.contextValue)) {
        schemaRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      schemaRegisteredCommandInPackageJson,
      'Expected schema tree item to be registered with a command in package json'
    );
  });

  suite('Schema Tree', () => {
    afterEach(() => cleanup());

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
          .then(async (schemaFields) => {
            await dataService.disconnect();

            assert(
              schemaFields.length === 0,
              `Expected no schema tree items to be returned, recieved ${schemaFields.length}`
            );
          })
          .then(done, done);
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
          .then(async (schemaFields) => {
            await dataService.disconnect();

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

    test('it only shows a dropdown for fields which are always documents', function (done) {
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
          .then(async (schemaFields) => {
            await dataService.disconnect();

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

  // to test:
  // - failing parse schema?
});
