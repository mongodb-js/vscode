import assert from 'assert';

import CollectionTreeItem from '../../../explorer/collectionTreeItem';
import { CollectionTypes } from '../../../explorer/documentListTreeItem';
import { ext } from '../../../extensionConstants';
import { ExtensionContextStub, DataServiceStub } from '../stubs';

const { contributes } = require('../../../../package.json');

suite('CollectionTreeItem Test Suite', () => {
  ext.context = new ExtensionContextStub();

  test('its context value should be in the package json', () => {
    let registeredCommandInPackageJson = false;
    const testCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection,
      },
      'mock_db_name',
      'imaginary data service',
      false,
      false,
      null
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

  test('when expanded shows a documents folder and schema folder', async () => {
    const testCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection,
      },
      'mock_db_name',
      new DataServiceStub(),
      false,
      false,
      null
    );

    await testCollectionTreeItem.onDidExpand();

    const collectionChildren = await testCollectionTreeItem.getChildren();

    assert(
      collectionChildren.length === 3,
      `Expected 3 children to be returned, found ${collectionChildren.length}`
    );
    assert(
      collectionChildren[0].label === 'Documents',
      `Expected first child tree item to be named Documents found ${collectionChildren[0].label}`
    );
    assert(
      collectionChildren[1].label === 'Schema',
      `Expected the second child tree item to be named Schema found ${collectionChildren[1].label}`
    );
    assert(
      collectionChildren[2].label === 'Indexes',
      `Expected the second child tree item to be named Indexes found ${collectionChildren[2].label}`
    );
  });

  test('when expanded it shows the document count in the description of the document list', async () => {
    const testCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection,
      },
      'mock_db_name',
      { estimatedCount: () => Promise.resolve(5000) },
      false,
      false,
      null
    );

    await testCollectionTreeItem.onDidExpand();

    const collectionChildren = await testCollectionTreeItem.getChildren();

    assert(
      collectionChildren[0].label === 'Documents',
      `Expected document list label to be 'Documents' got '${collectionChildren[0].label}'`
    );
    assert(
      collectionChildren[0].description === '5K',
      `Expected document list description to be '5K' got '${collectionChildren[0].description}'`
    );
    assert(
      collectionChildren[0].tooltip === 'Collection Documents - 5000',
      `Expected document list tooltip to be 'Collection Documents - 5000' got '${collectionChildren[0].tooltip}'`
    );
  });

  test('a view should show a different icon from a collection', () => {
    const testCollectionViewTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.view,
      },
      'mock_db_name',
      'imaginary data service',
      false,
      false,
      null
    );

    const viewIconPath = testCollectionViewTreeItem.iconPath;
    assert(
      viewIconPath.light.includes('view-folder.svg'),
      'Expected icon path to point to an svg by the name "view-folder" with a light mode'
    );
    assert(
      viewIconPath.dark.includes('view-folder.svg'),
      'Expected icon path to point to an svg by the name "view-folder" a dark mode'
    );

    const testCollectionCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection,
      },
      'mock_db_name',
      'imaginary data service',
      false,
      false,
      null
    );

    const collectionIconPath = testCollectionCollectionTreeItem.iconPath;
    assert(
      collectionIconPath.light.includes('collection-folder-closed.svg'),
      'Expected icon path to point to an svg by the name "collection" with a light mode'
    );
    assert(
      collectionIconPath.dark.includes('collection-folder-closed.svg'),
      'Expected icon path to point to an svg by the name "collection" with a light mode'
    );
  });

  test('a time-series collection should show a different icon from a collection', () => {
    const testCollectionViewTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.timeseries,
      },
      'mock_db_name',
      'imaginary data service',
      false,
      false,
      null
    );

    const viewIconPath = testCollectionViewTreeItem.iconPath;
    assert(
      viewIconPath.light.includes('collection-timeseries.svg'),
      'Expected icon path to point to an svg by the name "collection-timeseries" with a light mode'
    );
    assert(
      viewIconPath.dark.includes('collection-timeseries.svg'),
      'Expected icon path to point to an svg by the name "collection-timeseries" a dark mode'
    );

    const testCollectionCollectionTreeItem = new CollectionTreeItem(
      {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection,
      },
      'mock_db_name',
      'imaginary data service',
      false,
      false,
      null
    );

    const collectionIconPath = testCollectionCollectionTreeItem.iconPath;
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
