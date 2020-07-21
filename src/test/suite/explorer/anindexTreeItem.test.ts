import * as assert from 'assert';

import IndexTreeItem, {
  IndexFieldTreeItem,
  IndexKeyType
} from '../../../explorer/indexTreeItem';

suite('IndexTreeItem Test Suite', () => {
  test('it has tree items for each key in the index', async () => {
    const testIndexTreeItem = new IndexTreeItem(
      {
        v: 1,
        key: {
          _id: 1,
          gnocchi: -1
        },
        name: '_id_1_gnocchi_1',
        ns: 'tasty_fruits.pineapple'
      },
      'tasty_fruits.pineapple'
    );

    const indexKeyTreeItems = await testIndexTreeItem.getChildren();

    assert(
      indexKeyTreeItems.length === 2,
      `Expected 2 tree items to be returned, found ${indexKeyTreeItems.length}`
    );
    assert(
      indexKeyTreeItems[0].label === '_id',
      `Expected first child tree item to be named '_id' found ${indexKeyTreeItems[0].label}`
    );
    assert(
      indexKeyTreeItems[1].label === 'gnocchi',
      `Expected the second child tree item to be named 'gnocchi' found ${indexKeyTreeItems[1].label}`
    );
  });

  suite('IndexFieldTreeItem', () => {
    test('it has an icon for the index type', () => {
      const testIndexFieldTreeItem = new IndexFieldTreeItem(
        'locations',
        IndexKeyType.GEOSPHERE
      );

      const iconPath: any = testIndexFieldTreeItem.iconPath;
      assert(
        iconPath.dark.includes('index') && iconPath.dark.includes('geospatial.svg'),
        'Expected icon path to point to an svg by the name "geospatial" in the index folder'
      );
    });
  });
});
