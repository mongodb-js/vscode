import * as assert from 'assert';

import IndexTreeItem from '../../../explorer/IndexTreeItem';

suite('IndexListTreeItem Test Suite', () => {
  test('it has tree items for each key in the index', (done) => {
    const testIndexListTreeItem = new IndexTreeItem(
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

    testIndexListTreeItem
      .getChildren()
      .then((indexKeyTreeItems) => {
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
      })
      .then(done, done);
  });
});
