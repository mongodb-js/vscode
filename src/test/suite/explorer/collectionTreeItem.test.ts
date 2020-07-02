import * as assert from 'assert';

const { contributes } = require('../../../../package.json');

import CollectionTreeItem from '../../../explorer/collectionTreeItem';
import { CollectionTypes } from '../../../explorer/documentListTreeItem';
import { ext } from '../../../extensionConstants';

import { TestExtensionContext } from '../stubs';

suite('CollectionTreeItem Test Suite', () => {
  test('its context value should be in the package json', () => {
    let registeredCommandInPackageJson = false;

    const testCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection
      },
      'mock_db_name',
      'imaginary data service',
      false,
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

  test('when expanded shows a documents folder and schema folder', (done) => {
    const testCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection
      },
      'mock_db_name',
      'imaginary data service',
      false,
      false
    );

    testCollectionTreeItem.onDidExpand();

    testCollectionTreeItem
      .getChildren()
      .then((children) => {
        assert(
          children.length === 3,
          `Expected 3 children to be returned, found ${children.length}`
        );
        assert(
          children[0].label === 'Documents',
          `Expected first child tree item to be named Documents found ${children[0].label}`
        );
        assert(
          children[1].label === 'Schema',
          `Expected the second child tree item to be named Schema found ${children[1].label}`
        );
        assert(
          children[2].label === 'Indexes',
          `Expected the second child tree item to be named Indexes found ${children[2].label}`
        );
      })
      .then(done, done);
  });

  test('a view should show a different icon from a collection', () => {
    ext.context = new TestExtensionContext();

    const testCollectionViewTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.view
      },
      'mock_db_name',
      'imaginary data service',
      false,
      false
    );

    const viewIconPath: any = testCollectionViewTreeItem.iconPath;
    assert(
      viewIconPath.light.includes('view-folder.svg'),
      'Expected icon path to point to an svg by the name "view" with a light mode'
    );
    assert(
      viewIconPath.dark.includes('view-folder.svg'),
      'Expected icon path to point to an svg by the name "view" a dark mode'
    );

    const testCollectionCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection
      },
      'mock_db_name',
      'imaginary data service',
      false,
      false
    );

    const collectionIconPath: any = testCollectionCollectionTreeItem.iconPath;
    assert(
      collectionIconPath.light.includes('collection-folder-closed.svg'),
      'Expected icon path to point to an svg by the name "collection" with a light mode'
    );
    assert(
      collectionIconPath.dark.includes('collection-folder-closed.svg'),
      'Expected icon path to point to an svg by the name "collection" with a light mode'
    );
  });
});
