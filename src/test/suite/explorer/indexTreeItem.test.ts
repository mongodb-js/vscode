import assert from 'assert';

import IndexTreeItem, {
  IndexFieldTreeItem,
  IndexKeyType,
} from '../../../explorer/indexTreeItem';

suite('IndexTreeItem Test Suite', () => {
  test('it has tree items for each key in the index', async () => {
    const testIndexTreeItem = new IndexTreeItem({
      index: {
        v: 1,
        key: {
          _id: 1,
          gnocchi: -1,
        },
        name: '_id_1_gnocchi_1',
        ns: 'tasty_fruits.pineapple',
      },
      namespace: 'tasty_fruits.pineapple',
      isExpanded: false,
    });

    const indexKeyTreeItems = await testIndexTreeItem.getChildren();

    assert.strictEqual(indexKeyTreeItems.length, 2);
    assert.strictEqual(indexKeyTreeItems[0].label, '_id');
    assert.strictEqual(indexKeyTreeItems[1].label, 'gnocchi');
  });

  suite('IndexFieldTreeItem', () => {
    test('it has an icon for the index type', () => {
      const testIndexFieldTreeItem = new IndexFieldTreeItem({
        indexKey: 'locations',
        indexKeyType: IndexKeyType.GEOSPHERE,
      });

      const iconPath = testIndexFieldTreeItem.iconPath as {
        light: string;
        dark: string;
      };
      assert(
        iconPath.dark.includes('index') &&
          iconPath.dark.includes('geospatial.svg'),
        'Expected icon path to point to an svg by the name "geospatial" in the index folder'
      );
    });
  });
});
