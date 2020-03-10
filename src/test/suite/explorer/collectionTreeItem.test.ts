import * as assert from 'assert';

const { contributes } = require('../../../../package.json');

import CollectionTreeItem from '../../../explorer/collectionTreeItem';
import { CollectionTypes } from '../../../explorer/documentListTreeItem';

suite('CollectionTreeItem Test Suite', () => {
  test('its context value should be in the package json', function () {
    let registeredCommandInPackageJson = false;

    const testCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection
      },
      'mock_db_name',
      'imaginary data service',
      false
    );

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testCollectionTreeItem.contextValue)) {
        registeredCommandInPackageJson = true;
      }
    });

    assert(
      registeredCommandInPackageJson,
      'Expected collection tree item to be registered with a command in package json'
    );
  });

  test('when expanded shows a documents folder and schema folder', function (done) {
    const testCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection
      },
      'mock_db_name',
      'imaginary data service',
      false
    );

    testCollectionTreeItem
      .getChildren()
      .then((children) => {
        assert(
          children.length === 2,
          `Expected 2 children to be returned, found ${children.length}`
        );
        assert(
          children[0].label === 'Documents',
          `Expected first child tree item to be named Documents found ${children[0].label}`
        );
        assert(
          children[1].label === 'Schema',
          `Expected the second child tree item to be named Schema found ${children[1].label}`
        );
      })
      .then(done, done);
  });
});
