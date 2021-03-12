import assert from 'assert';
import * as vscode from 'vscode';
import { Document } from 'mongodb';

const { contributes } = require('../../../../package.json');

import IndexListTreeItem from '../../../explorer/indexListTreeItem';

suite('IndexListTreeItem Test Suite', () => {
  test('its context value should be in the package json', () => {
    let indexListRegisteredCommandInPackageJson = false;
    const testIndexListTreeItem = new IndexListTreeItem(
      'pineapple',
      'tasty_fruits',
      {} as any,
      false,
      false,
      []
    );

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testIndexListTreeItem.contextValue)) {
        indexListRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      indexListRegisteredCommandInPackageJson,
      'Expected index list tree item to be registered with a command in package json'
    );
  });

  test('when expanded it fetches indexes and shows them', async () => {
    const fakeFetchIndexes = [
      {
        v: 1,
        key: {
          _id: 1
        },
        name: '_id_'
      },
      {
        v: 1,
        key: {
          _id: 1,
          gnocchi: -1
        },
        name: '_id_1_gnocchi_1'
      }
    ];

    let namespaceRequested = '';
    const testIndexListTreeItem = new IndexListTreeItem(
      'pineapple',
      'tasty_fruits',
      {
        db: () => ({
          collection: () => ({
            indexes: (ns: string): Promise<Document> => {
              namespaceRequested = ns;

              return Promise.resolve(fakeFetchIndexes);
            }
          })
        })
      } as any,
      false,
      false,
      []
    );

    await testIndexListTreeItem.onDidExpand();

    let indexTreeItems: vscode.TreeItem[];

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
      {} as any,
      false,
      false,
      []
    );

    const indexesIconPath: any = testIndexListTreeItem.iconPath;
    assert(
      indexesIconPath.dark.includes('indexes.svg'),
      'Expected icon path to point to an svg by the name "indexes" with a dark mode'
    );
  });

  test('when theres an error fetching indexes, the error is thrown in the caller (no timeout)', async () => {
    const expectedErrorMessage = 'Some error message indexes could throw';
    const testIndexListTreeItem = new IndexListTreeItem(
      'pineapple',
      'tasty_fruits',
      {
        db: () => ({
          collection: () => ({
            indexes: (): Promise<Document> => {
              throw new Error(expectedErrorMessage);
            }
          })
        })
      } as any,
      false,
      false,
      []
    );

    await testIndexListTreeItem.onDidExpand();

    try {
      await testIndexListTreeItem.getChildren();

      assert(false, 'Expected an error to be thrown');
    } catch (err) {
      assert(err.message === expectedErrorMessage, `Expected error message to be '${expectedErrorMessage}' found '${err.message}'`);
    }
  });


  test('when rebuilt it maintains the expanded state of the cached indexes', async () => {
    const fakeFetchIndexes = [
      {
        v: 1,
        key: {
          _id: 1
        },
        name: '_id_'
      },
      {
        v: 1,
        key: {
          _id: 1,
          gnocchi: -1
        },
        name: '_id_1_gnocchi_1'
      }
    ];

    const testIndexListTreeItem = new IndexListTreeItem(
      'pineapple',
      'tasty_fruits',
      {
        db: () => ({
          collection: () => ({
            indexes: (): Promise<Document> => {
              return Promise.resolve(fakeFetchIndexes);
            }
          })
        })
      } as any,
      false,
      false,
      []
    );

    await testIndexListTreeItem.onDidExpand();

    let indexTreeItems;

    try {
      indexTreeItems = await testIndexListTreeItem.getChildren();
    } catch (err) {
      assert(false, `Expected no error, found: ${err.message}`);
    }

    indexTreeItems[0].onDidExpand();

    const newIndexListTreeItem = new IndexListTreeItem(
      testIndexListTreeItem.collectionName,
      testIndexListTreeItem.databaseName,
      {
        db: () => ({
          collection: () => ({
            indexes: (): Promise<Document> => {
              return Promise.resolve([]);
            }
          })
        })
      } as any,
      testIndexListTreeItem.isExpanded,
      testIndexListTreeItem.cacheIsUpToDate,
      testIndexListTreeItem.getChildrenCache()
    );

    let newIndexTreeItems;
    try {
      newIndexTreeItems = await newIndexListTreeItem.getChildren();
    } catch (err) {
      assert(false, `Expected no error, found: ${err.message}`);
    }

    assert(
      newIndexTreeItems[1].label === '_id_1_gnocchi_1',
      `Expected the second child tree item to be named '_id_1_gnocchi_1' found ${newIndexTreeItems[1].label}`
    );
    assert(
      newIndexTreeItems[0].isExpanded,
      'Expected the first index in list to be expanded'
    );
    assert(
      newIndexTreeItems[0].collapsibleState === vscode.TreeItemCollapsibleState.Expanded,
      'Expected the first index in list have expanded tree state'
    );
  });
});
