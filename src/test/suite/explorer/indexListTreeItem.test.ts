import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import type { DataService, IndexDefinition } from 'mongodb-data-service';

import formatError from '../../../utils/formatError';
import IndexListTreeItem from '../../../explorer/indexListTreeItem';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../../../package.json');

function getTestIndexListTreeItem(
  options?: Partial<ConstructorParameters<typeof IndexListTreeItem>[0]>,
): IndexListTreeItem {
  return new IndexListTreeItem({
    collectionName: 'zebraWearwolf',
    databaseName: 'giraffeVampire',
    dataService: {} as DataService,
    isExpanded: false,
    cacheIsUpToDate: false,
    childrenCache: [],
    ...options,
  });
}

suite('IndexListTreeItem Test Suite', () => {
  let showErrorMessageStub: SinonStub;
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  test('its context value should be in the package json', () => {
    let indexListRegisteredCommandInPackageJson = false;
    const testIndexListTreeItem = getTestIndexListTreeItem();

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testIndexListTreeItem.contextValue)) {
        indexListRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      indexListRegisteredCommandInPackageJson,
      'Expected index list tree item to be registered with a command in package json',
    );
  });

  test('when expanded it fetches indexes and shows them', async () => {
    const fakeFetchIndexes = [
      {
        v: 1,
        key: {
          _id: 1,
        },
        name: '_id_',
        ns: 'giraffeVampire.pineapple',
      },
      {
        v: 1,
        key: {
          _id: 1,
          gnocchi: -1,
        },
        name: '_id_1_gnocchi_1',
        ns: 'giraffeVampire.pineapple',
      },
    ];

    let namespaceRequested = '';
    const testIndexListTreeItem = getTestIndexListTreeItem({
      collectionName: 'pineapple',
      dataService: {
        indexes: (ns): ReturnType<DataService['indexes']> => {
          namespaceRequested = ns;

          return Promise.resolve(fakeFetchIndexes as any[]);
        },
      } as DataService,
    });

    await testIndexListTreeItem.onDidExpand();

    let indexTreeItems;

    try {
      indexTreeItems = await testIndexListTreeItem.getChildren();
    } catch (error) {
      assert(false, `Expected no error, found: ${formatError(error).message}`);
    }

    assert.strictEqual(namespaceRequested, 'giraffeVampire.pineapple');
    assert.strictEqual(indexTreeItems.length, 2);
    assert.strictEqual(indexTreeItems[0].label, '_id_');
    assert.strictEqual(indexTreeItems[1].label, '_id_1_gnocchi_1');
  });

  test('it shows an indexes icon', () => {
    const testIndexListTreeItem = getTestIndexListTreeItem({
      collectionName: 'pineapple',
      dataService: {
        indexes: (): ReturnType<DataService['indexes']> => {
          return Promise.resolve([] as IndexDefinition[]);
        },
      } as unknown as DataService,
    });

    const indexesIconPath = testIndexListTreeItem.iconPath as {
      light: string;
      dark: string;
    };
    assert(
      indexesIconPath.dark.includes('indexes.svg'),
      'Expected icon path to point to an svg by the name "indexes" with a dark mode',
    );
  });

  test('when theres an error fetching indexes, the error is thrown in the caller (no timeout)', async () => {
    const expectedMessage = 'Some error message indexes could throw';
    const testIndexListTreeItem = getTestIndexListTreeItem({
      dataService: {
        indexes: (): ReturnType<DataService['indexes']> => {
          return Promise.reject(new Error(expectedMessage));
        },
      } as unknown as DataService,
    });

    await testIndexListTreeItem.onDidExpand();

    try {
      await testIndexListTreeItem.getChildren();

      assert.strictEqual(
        showErrorMessageStub.firstCall.args[0],
        expectedMessage,
      );
    } catch (error) {
      assert(!!error, 'Expected an error disconnect response.');
    }
  });

  test('when rebuilt it maintains the expanded state of the cached indexes', async () => {
    const fakeFetchIndexes = [
      {
        v: 1,
        key: {
          _id: 1,
        },
        name: '_id_',
        ns: 'giraffeVampire.pineapple',
      },
      {
        v: 1,
        key: {
          _id: 1,
          gnocchi: -1,
        },
        name: '_id_1_gnocchi_1',
        ns: 'giraffeVampire.pineapple',
      },
    ];

    const testIndexListTreeItem = getTestIndexListTreeItem({
      collectionName: 'pineapple',
      dataService: {
        indexes: (): ReturnType<DataService['indexes']> => {
          return Promise.resolve(fakeFetchIndexes as any[]);
        },
      } as unknown as DataService,
    });

    await testIndexListTreeItem.onDidExpand();

    let indexTreeItems;

    try {
      indexTreeItems = await testIndexListTreeItem.getChildren();
    } catch (error) {
      assert(false, `Expected no error, found: ${formatError(error).message}`);
    }

    indexTreeItems[0].onDidExpand();

    const newIndexListTreeItem = getTestIndexListTreeItem({
      collectionName: testIndexListTreeItem.collectionName,
      databaseName: testIndexListTreeItem.databaseName,
      dataService: {
        indexes: (): ReturnType<DataService['indexes']> => {
          return Promise.resolve([]);
        },
      } as unknown as DataService,
      isExpanded: testIndexListTreeItem.isExpanded,
      cacheIsUpToDate: testIndexListTreeItem.cacheIsUpToDate,
      childrenCache: testIndexListTreeItem.getChildrenCache(),
    });

    let newIndexTreeItems;
    try {
      newIndexTreeItems = await newIndexListTreeItem.getChildren();
    } catch (error) {
      assert(false, `Expected no error, found: ${formatError(error).message}`);
    }

    assert.strictEqual(newIndexTreeItems[1].label, '_id_1_gnocchi_1');
    assert(
      newIndexTreeItems[0].isExpanded,
      'Expected the first index in list to be expanded',
    );
    assert.strictEqual(
      newIndexTreeItems[0].collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded,
    );
  });
});
