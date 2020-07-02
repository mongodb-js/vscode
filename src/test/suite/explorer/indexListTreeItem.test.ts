import * as assert from 'assert';

import IndexListTreeItem from '../../../explorer/indexListTreeItem';

suite('IndexListTreeItem Test Suite', () => {
  test('when expanded it fetches indexes and shows them', async () => {
    const fakeFetchIndexes = [
      {
        v: 1,
        key: {
          _id: 1
        },
        name: '_id_',
        ns: 'tasty_fruits.pineapple'
      },
      {
        v: 1,
        key: {
          _id: 1,
          gnocchi: -1
        },
        name: '_id_1_gnocchi_1',
        ns: 'tasty_fruits.pineapple'
      }
    ];

    let namespaceRequested = '';
    const testIndexListTreeItem = new IndexListTreeItem(
      'pineapple',
      'tasty_fruits',
      {
        indexes: (ns, opts, cb) => {
          namespaceRequested = ns;

          cb(null, fakeFetchIndexes);
        }
      },
      false,
      null
    );

    await testIndexListTreeItem.onDidExpand();

    let indexTreeItems;

    try {
      indexTreeItems = await testIndexListTreeItem.getChildren();
    } catch (err) {
      assert(false, `Expected no error, found: ${err.message}`);
    }

    assert(namespaceRequested === 'tasty_fruits.pineapple');

    assert(
      indexTreeItems.length === 2,
      `Expected 2 indexTreeItems to be returned, found ${indexTreeItems.length}`
    );
    assert(
      indexTreeItems[0].label === '_id_',
      `Expected first child tree item to be named '_id_' found ${indexTreeItems[0].label}`
    );
    assert(
      indexTreeItems[1].label === '_id_1_gnocchi_1',
      `Expected the second child tree item to be named '_id_1_gnocchi_1' found ${indexTreeItems[1].label}`
    );
  });

  test('it shows an indexes icon', () => {
    const testIndexListTreeItem = new IndexListTreeItem(
      'pineapple',
      'tasty_fruits',
      'fake data service',
      false,
      null
    );

    const indexesIconPath: any = testIndexListTreeItem.iconPath;
    assert(
      indexesIconPath.dark.includes('indexes.svg'),
      'Expected icon path to point to an svg by the name "indexes" with a dark mode'
    );
  });
});
