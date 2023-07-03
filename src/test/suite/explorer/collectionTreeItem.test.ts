import assert from 'assert';
import type { DataService } from 'mongodb-data-service';

import CollectionTreeItem from '../../../explorer/collectionTreeItem';
import type { CollectionDetailsType } from '../../../explorer/collectionTreeItem';
import { CollectionTypes } from '../../../explorer/documentListTreeItem';
import { ext } from '../../../extensionConstants';
import { ExtensionContextStub, DataServiceStub } from '../stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../../../package.json');

function getTestCollectionTreeItem(
  options?: Partial<ConstructorParameters<typeof CollectionTreeItem>[0]>
) {
  return new CollectionTreeItem({
    collection: {
      name: 'testColName',
      type: CollectionTypes.collection,
    } as unknown as CollectionDetailsType,
    databaseName: 'testDbName',
    dataService: {} as DataService,
    isExpanded: false,
    cacheIsUpToDate: false,
    cachedDocumentCount: null,
    ...options,
  });
}

suite('CollectionTreeItem Test Suite', () => {
  ext.context = new ExtensionContextStub();

  test('its context value should be in the package json', () => {
    let registeredCommandInPackageJson = false;
    const testCollectionTreeItem = getTestCollectionTreeItem();

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testCollectionTreeItem.contextValue)) {
        registeredCommandInPackageJson = true;
      }
    });

    assert.strictEqual(registeredCommandInPackageJson, true);
  });

  test('when expanded shows a documents folder and schema folder', async () => {
    const testCollectionTreeItem = getTestCollectionTreeItem({
      dataService: new DataServiceStub() as unknown as DataService,
    });

    await testCollectionTreeItem.onDidExpand();

    const collectionChildren = await testCollectionTreeItem.getChildren();

    assert.strictEqual(collectionChildren.length, 3);
    assert.strictEqual(collectionChildren[0].label, 'Documents');
    assert.strictEqual(collectionChildren[1].label, 'Schema');
    assert.strictEqual(collectionChildren[2].label, 'Indexes');
  });

  test('when expanded it shows the document count in the description of the document list', async () => {
    const testCollectionTreeItem = getTestCollectionTreeItem({
      dataService: {
        estimatedCount: () => Promise.resolve(5000),
      } as unknown as DataService,
    });

    await testCollectionTreeItem.onDidExpand();

    const collectionChildren = await testCollectionTreeItem.getChildren();

    assert.strictEqual(collectionChildren[0].label, 'Documents');
    assert.strictEqual(collectionChildren[0].description, '5K');
    assert.strictEqual(
      collectionChildren[0].tooltip,
      'Collection Documents - 5000'
    );
  });

  test('a view should show a different icon from a collection', () => {
    const testCollectionViewTreeItem = getTestCollectionTreeItem({
      collection: {
        name: 'mock_collection_name_1',
        type: CollectionTypes.view,
      } as unknown as CollectionDetailsType,
    });

    const viewIconPath = testCollectionViewTreeItem.iconPath;
    assert.strictEqual(viewIconPath.light.includes('view-folder.svg'), true);
    assert.strictEqual(viewIconPath.dark.includes('view-folder.svg'), true);

    const testCollectionCollectionTreeItem = getTestCollectionTreeItem({
      collection: {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection,
      } as unknown as CollectionDetailsType,
    });
    const collectionIconPath = testCollectionCollectionTreeItem.iconPath;
    assert.strictEqual(
      collectionIconPath.light.includes('collection-folder-closed.svg'),
      true
    );
    assert.strictEqual(
      collectionIconPath.dark.includes('collection-folder-closed.svg'),
      true
    );
  });

  test('a time-series collection should show a different icon from a collection', () => {
    const testCollectionTimeSeriesTreeItem = getTestCollectionTreeItem({
      collection: {
        name: 'mock_collection_name_1',
        type: CollectionTypes.timeseries,
      } as unknown as CollectionDetailsType,
    });
    const viewIconPath = testCollectionTimeSeriesTreeItem.iconPath;
    assert.strictEqual(
      viewIconPath.light.includes('collection-timeseries.svg'),
      true
    );
    assert.strictEqual(
      viewIconPath.dark.includes('collection-timeseries.svg'),
      true
    );

    const testCollectionCollectionTreeItem = getTestCollectionTreeItem({
      collection: {
        name: 'mock_collection_name_1',
        type: CollectionTypes.collection,
      } as unknown as CollectionDetailsType,
    });
    const collectionIconPath = testCollectionCollectionTreeItem.iconPath;
    assert.strictEqual(
      collectionIconPath.light.includes('collection-folder-closed.svg'),
      true
    );
    assert.strictEqual(
      collectionIconPath.dark.includes('collection-folder-closed.svg'),
      true
    );
  });
});
