import * as vscode from 'vscode';
import assert from 'assert';
import { beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import type { DataService } from 'mongodb-data-service';

import ConnectionTreeItem from '../../../explorer/connectionTreeItem';
import { DataServiceStub } from '../stubs';
import formatError from '../../../utils/formatError';
import { mdbTestExtension } from '../stubbableMdbExtension';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../../../package.json');

function getTestConnectionTreeItem(): ConnectionTreeItem {
  return new ConnectionTreeItem({
    connectionId: 'test',
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    isExpanded: true,
    connectionController:
      mdbTestExtension.testExtensionController._connectionController,
    cacheIsUpToDate: false,
    childrenCache: {},
    source: 'user',
  });
}

suite('ConnectionTreeItem Test Suite', function () {
  test('its context value should be in the package json', function () {
    let connectedRegisteredCommandInPackageJson = false;
    let disconnectedRegisteredCommandInPackageJson = false;

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes('connected')) {
        connectedRegisteredCommandInPackageJson = true;
      }
      if (contextItem.when.includes('disconnected')) {
        disconnectedRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      connectedRegisteredCommandInPackageJson,
      'Expected connected connection tree item to be registered with a command in package json',
    );
    assert(
      disconnectedRegisteredCommandInPackageJson,
      'Expected disconnected connection tree item to be registered with a command in package json',
    );
  });

  suite('#getChildren', function () {
    let testConnectionTreeItem: ConnectionTreeItem;
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
      testConnectionTreeItem = getTestConnectionTreeItem();
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('returns database tree items with the databases', async function () {
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () => new DataServiceStub() as unknown as DataService,
      );

      const databaseItems = await testConnectionTreeItem.getChildren();

      assert.strictEqual(databaseItems.length, 3);
      assert.strictEqual(databaseItems[0].label, 'mockDatabase1');
      assert.strictEqual(databaseItems[2].label, 'mockDatabase3');
    });

    test('when listDatabases errors it wraps it in a nice message', async function () {
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () =>
          ({
            listDatabases: () =>
              new Promise(() => {
                throw Error('peaches');
              }),
          }) as unknown as DataService,
      );

      try {
        await testConnectionTreeItem.getChildren();
        assert(false);
      } catch (error) {
        assert.strictEqual(
          formatError(error).message,
          'Unable to list databases: peaches',
        );
      }
    });

    suite('when connected to a Stream Processing Instnace', function () {
      beforeEach(function () {
        sandbox.replace(
          mdbTestExtension.testExtensionController._connectionController,
          'isConnectedToAtlasStreams',
          () => true,
        );
      });

      test('returns stream processor tree items', async function () {
        sandbox.replace(
          mdbTestExtension.testExtensionController._connectionController,
          'getActiveDataService',
          () => new DataServiceStub() as unknown as DataService,
        );

        const spItems = await testConnectionTreeItem.getChildren();

        assert.strictEqual(spItems.length, 2);
        assert.strictEqual(spItems[0].label, 'mockStreamProcessor1');
        assert.strictEqual(spItems[1].label, 'mockStreamProcessor2');
      });

      test('when listStreamProcessors errors it wraps it in a nice message', async function () {
        sandbox.replace(
          mdbTestExtension.testExtensionController._connectionController,
          'getActiveDataService',
          () =>
            ({
              listStreamProcessors: () =>
                new Promise(() => {
                  throw Error('peaches');
                }),
            }) as unknown as DataService,
        );

        try {
          await testConnectionTreeItem.getChildren();
          assert(false);
        } catch (error) {
          assert.strictEqual(
            formatError(error).message,
            'Unable to list stream processors: peaches',
          );
        }
      });
    });
  });

  suite('#listDatabases', function () {
    let testConnectionTreeItem: ConnectionTreeItem;
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
      testConnectionTreeItem = getTestConnectionTreeItem();
    });

    afterEach(() => {
      sandbox.restore();
    });

    test('returns a list of database names', async function () {
      sandbox.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () => new DataServiceStub() as unknown as DataService,
      );

      const dbNames = await testConnectionTreeItem.listDatabases();

      assert.strictEqual(dbNames.length, 3);
      assert(dbNames.includes('mockDatabase2'));
    });
  });
});
