/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as vscode from 'vscode';
import assert from 'assert';
import { beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';

import ConnectionTreeItem, {
  ConnectionItemContextValues,
} from '../../../explorer/connectionTreeItem';
import { DataServiceStub } from '../stubs';
import formatError from '../../../utils/formatError';
import { mdbTestExtension } from '../stubbableMdbExtension';

const { contributes } = require('../../../../package.json');

suite('ConnectionTreeItem Test Suite', () => {
  test('its context value should be in the package json', function () {
    let connectedRegisteredCommandInPackageJson = false;
    let disconnectedRegisteredCommandInPackageJson = false;

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(ConnectionItemContextValues.connected)) {
        connectedRegisteredCommandInPackageJson = true;
      }
      if (contextItem.when.includes(ConnectionItemContextValues.disconnected)) {
        disconnectedRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      connectedRegisteredCommandInPackageJson,
      'Expected connected connection tree item to be registered with a command in package json'
    );
    assert(
      disconnectedRegisteredCommandInPackageJson,
      'Expected disconnected connection tree item to be registered with a command in package json'
    );
  });

  suite('#getChildren', () => {
    let testConnectionTreeItem: ConnectionTreeItem;

    beforeEach(() => {
      testConnectionTreeItem = new ConnectionTreeItem(
        '',
        vscode.TreeItemCollapsibleState.Expanded,
        true,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('returns database tree items with the databases', async () => {
      sinon.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () => new DataServiceStub() as any
      );

      const databaseItems = await testConnectionTreeItem.getChildren();

      assert.strictEqual(databaseItems.length, 3);
      assert.strictEqual(databaseItems[0].label, 'mockDatabase1');
      assert.strictEqual(databaseItems[2].label, 'mockDatabase3');
    });

    test('when listDatabases errors it wraps it in a nice message', async () => {
      sinon.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () =>
          ({
            listDatabases: () =>
              new Promise(() => {
                throw Error('peaches');
              }),
          } as any)
      );

      try {
        await testConnectionTreeItem.getChildren();
        assert(false);
      } catch (error) {
        assert.strictEqual(
          formatError(error).message,
          'Unable to list databases: peaches'
        );
      }
    });
  });

  suite('#listDatabases', () => {
    let testConnectionTreeItem: ConnectionTreeItem;

    beforeEach(() => {
      testConnectionTreeItem = new ConnectionTreeItem(
        '',
        vscode.TreeItemCollapsibleState.Expanded,
        true,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    test('returns a list of database names', async () => {
      sinon.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () => new DataServiceStub() as any
      );

      const dbNames = await testConnectionTreeItem.listDatabases();

      assert.strictEqual(dbNames.length, 3);
      assert(dbNames.includes('mockDatabase2'));
    });
  });
});
