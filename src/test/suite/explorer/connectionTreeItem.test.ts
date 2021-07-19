/* eslint-disable @typescript-eslint/no-unsafe-return */
import assert from 'assert';
import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { MongoClient } from 'mongodb';

const { contributes } = require('../../../../package.json');

import ConnectionTreeItem, {
  ConnectionItemContextValues,
  getDatabaseNamesFromPrivileges
} from '../../../explorer/connectionTreeItem';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { DataServiceStub } from '../stubs';
import { TEST_DATABASE_URI, TEST_DATABASE_URI_USER, TEST_USER_PASSWORD, TEST_USER_USERNAME } from '../dbTestHelper';

const mockPrivileges = [{}, {
  resource: {
    db: 'db2',
    roles: ['readWrite', 'listCollections']
  }
}, {
  resource: {
    db: 'db3',
    roles: ['readWrite', 'listCollections']
  }
}, {
  resource: {
    db: 'pineapple',
    roles: ['read', 'listCollections']
  },
}, {
  resource: {
    db: 'db1',
    roles: ['readWrite', 'listCollections']
  }
}];

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
        () => ({
          listDatabases: (cb) => { cb(new Error('peaches')); }
        }) as any
      );

      try {
        await testConnectionTreeItem.getChildren();
        assert(false);
      } catch (err) {
        assert.strictEqual(err.message, 'Unable to list databases: peaches');
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

    test('when list databases errors with not authorization error it does not call listDatabasesUserHasAccessTo', async () => {
      sinon.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () => ({
          listDatabases: (cb) => { cb(new Error('the dog is barking at a squirrel')); }
        }) as any
      );

      const fake = sinon.fake.resolves([]);
      sinon.replace(
        testConnectionTreeItem,
        'listDatabasesUserHasAccessTo',
        fake
      );

      try {
        await testConnectionTreeItem.listDatabases();
        assert(false, 'Expected to error and did not');
      } catch (_) {
        assert(!fake.called);
      }
    });

    test('when list databases errors with authorization error it calls listDatabasesUserHasAccessTo', async () => {
      sinon.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () => ({
          listDatabases: (cb) => {
            cb(new Error('not allowed to listDatabases'));
          },
          client: {}
        }) as any
      );

      const fake = sinon.fake.resolves([]);
      sinon.replace(
        testConnectionTreeItem,
        'listDatabasesUserHasAccessTo',
        fake
      );

      await testConnectionTreeItem.listDatabases();
      assert(fake.called);
    });

    test('when list databases errors with authorization error it reads privileges to get possible dbs', async () => {
      const mockDbCommandResult = {
        authInfo: {
          authenticatedUserPrivileges: mockPrivileges
        }
      };

      const mockDataserviceClient = {
        client: {
          db: () => ({
            databaseName: 'admin',
            command: () => {
              return new Promise(resolve => {
                resolve(mockDbCommandResult);
              });
            }
          })
        }
      };

      sinon.replace(
        mdbTestExtension.testExtensionController._connectionController,
        'getActiveDataService',
        () => ({
          listDatabases: (cb) => {
            cb(new Error('not allowed to listDatabases'));
          },
          client: mockDataserviceClient
        }) as any
      );

      const dbs = await testConnectionTreeItem.listDatabases();

      assert.strictEqual(dbs.length, 4);
      assert(dbs.includes('pineapple'));
    });
  });

  suite('#listDatabasesUserHasAccessTo', () => {
    let testConnectionTreeItem: ConnectionTreeItem;
    let adminClient = new MongoClient(TEST_DATABASE_URI);
    let userClient = new MongoClient(TEST_DATABASE_URI);

    beforeEach(async () => {
      testConnectionTreeItem = new ConnectionTreeItem(
        '',
        vscode.TreeItemCollapsibleState.Expanded,
        true,
        mdbTestExtension.testExtensionController._connectionController,
        false,
        {}
      );
      adminClient = new MongoClient(TEST_DATABASE_URI);
      await adminClient.connect();

      const adminDb = adminClient.db().admin();
      // Create a new user with access to a db.
      await adminDb.addUser(
        TEST_USER_USERNAME,
        TEST_USER_PASSWORD,
        {
          roles: [{
            role: 'readWrite',
            db: 'coffee'
          }]
        }
      );

      userClient = new MongoClient(TEST_DATABASE_URI_USER);
      await userClient.connect();
    });

    afterEach(async () => {
      // Remove the user we created.
      const adminDb = adminClient.db().admin();
      await adminDb.removeUser(TEST_USER_USERNAME);

      await adminClient.close();
      await userClient.close();
      sinon.restore();
    });

    test('returns a list of database names the authenticated user might be able to use', async () => {
      const dbNames = await testConnectionTreeItem.listDatabasesUserHasAccessTo(
        userClient
      );

      assert.strictEqual(dbNames.length, 1);
      assert.strictEqual(dbNames[0], 'coffee');
    });
  });

  suite('#getDatabaseNamesFromPrivileges', () => {
    test('it returns a sorted list of privileges', () => {
      assert.deepStrictEqual(
        getDatabaseNamesFromPrivileges(mockPrivileges),
        ['db1', 'db2', 'db3', 'pineapple']
      );
    });

    test('it returns an empty array when there are no privileges', () => {
      const privs = [];
      assert.deepStrictEqual(getDatabaseNamesFromPrivileges(privs), []);
    });

    test('it returns an empty array when there are no resources', () => {
      const privs = [{}];
      assert.deepStrictEqual(getDatabaseNamesFromPrivileges(privs), []);
    });
  });
});
