import assert from 'assert';
import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import Connection = require('mongodb-connection-model/lib/model');
const sinon = require('sinon');

import {
  DefaultSavingLocations,
  StorageScope
} from '../../../storage/storageController';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { mdbTestExtension } from '../stubbableMdbExtension';

const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=500&serverSelectionTimeoutMS=500';

suite('Explorer Controller Test Suite', function () {
  // Longer timeout, sometimes it takes a few seconds for vscode to
  // load the extension before running tests.
  this.timeout(10000);

  beforeEach(async () => {
    // Don't save connections on default.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations['Session Only']
      );
    // Here we stub the showInformationMessage process because it is too much
    // for the render process and leads to crashes while testing.
    sinon.replace(vscode.window, 'showInformationMessage', sinon.stub());
  });

  afterEach(async () => {
    // Unset the variable we set in `beforeEach`.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    // Reset our connections.
    await mdbTestExtension.testExtensionController._connectionController.disconnect();
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    sinon.restore();
    mdbTestExtension.testExtensionController._explorerController.deactivate();
  });

  test('it updates the connections to account for a change in the connection controller', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();
    const mockConnectionId = 'testConnectionId';

    testConnectionController._connections = {
      testConnectionId: {
        id: 'testConnectionId',
        connectionModel: new Connection(),
        name: 'testConnectionName',
        driverUrl: 'url',
        storageLocation: StorageScope.NONE
      }
    };
    testConnectionController.setConnnectingConnectionId(mockConnectionId);
    testConnectionController.setConnnecting(true);

    const connectionsItems = await treeController.getChildren();

    assert(
      connectionsItems.length === 1,
      `Expected there to be 1 connection tree item, found ${connectionsItems.length}`
    );
    assert(
      connectionsItems[0].label === 'testConnectionName',
      'There should be a connection tree item with the label "testConnectionName"'
    );
  });

  test('when a connection is added and connected it is added to the tree', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    const succesfullyConnected = await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    assert(
      succesfullyConnected === true,
      'Expected a successful connection response.'
    );
    assert(
      Object.keys(testConnectionController._connections).length === 1,
      'Expected there to be 1 connection in the connection list.'
    );

    const activeId = testConnectionController.getActiveConnectionId();

    assert(
      activeId === Object.keys(testConnectionController._connections)[0],
      `Expected active connection to be '${Object.keys(testConnectionController._connections)[0]
      }' found ${activeId}`
    );

    const connectionsItems = await treeController.getChildren();

    assert(
      connectionsItems.length === 1,
      `Expected there be 1 connection tree item, found ${connectionsItems.length}`
    );
    assert(
      connectionsItems[0].label === 'localhost:27018',
      'There should be a connection tree item with the label "localhost:27018"'
    );
    assert(
      connectionsItems[0].description === 'connected',
      'There should be a connection tree item with the description "connected"'
    );
  });

  test('only the active connection is displayed as connected in the tree', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    const succesfullyConnected = await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    assert(
      succesfullyConnected === true,
      'Expected a successful connection response.'
    );
    assert(
      Object.keys(testConnectionController._connections).length === 1,
      'Expected there to be 1 connection in the connection list.'
    );

    const connectionId = testConnectionController.getActiveConnectionId() || '';
    const connectionName =
      testConnectionController._connections[connectionId].name;

    assert(
      connectionName === 'localhost:27018',
      `Expected active connection name to be 'localhost:27018' found ${connectionName}`
    );

    try {
      await testConnectionController.addNewConnectionStringAndConnect(
        testDatabaseURI2WithTimeout
      );
    } catch (error) {
      /* Silent fail (should fail) */
    }

    const connectionsItems = await treeController.getChildren();

    assert(
      connectionsItems.length === 2,
      `Expected there be 2 connection tree item, found ${connectionsItems.length}`
    );
    assert(
      connectionsItems[0].label === 'localhost:27018',
      `First connection tree item should have label "localhost:27018" found ${connectionsItems[0].label}`
    );
    assert(
      connectionsItems[0].isExpanded === false,
      'Expected the first connection tree item to not be expanded'
    );
    assert(
      connectionsItems[1].label === 'shouldfail:27017',
      'Second connection tree item should have label "shouldfail:27017"'
    );
  });

  test('shows connection names sorted alphabetically in the tree', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const connectionId = testConnectionController.getActiveConnectionId() || '';

    testConnectionController._connections.aaa = {
      connectionModel:
        testConnectionController._connections[connectionId].connectionModel,
      driverUrl: '',
      name: 'aaa',
      id: 'aaa',
      storageLocation: StorageScope.WORKSPACE
    };

    testConnectionController._connections.zzz = {
      connectionModel:
        testConnectionController._connections[connectionId].connectionModel,
      driverUrl: '',
      name: 'zzz',
      id: 'zzz',
      storageLocation: StorageScope.WORKSPACE
    };

    const connectionsItems = await treeController.getChildren();

    assert(
      connectionsItems.length === 3,
      `Expected there be 3 connection tree item, found ${connectionsItems.length}`
    );
    assert(
      connectionsItems[0].label === 'aaa',
      `First connection tree item should have label "aaa" found ${connectionsItems[0].label}`
    );
    assert(
      connectionsItems[2].label === 'zzz',
      `First connection tree item should have label "zzz" found ${connectionsItems[0].label}`
    );

    testConnectionController._connections.zzz.name = '111';

    const afterAdditionConnectionsItems = await treeController.getChildren();

    assert(
      afterAdditionConnectionsItems[0].label === '111',
      `First connection tree item should have label "111" found ${afterAdditionConnectionsItems[0].label}`
    );
  });

  test('shows the databases of connected connection in tree', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const connectionsItems = await treeController.getChildren();
    const databaseItems = await connectionsItems[0].getChildren();

    assert(
      databaseItems.length >= 3,
      `Expected there be 3 or more database tree items, found ${databaseItems.length}`
    );
    assert(
      databaseItems[0].label === 'admin',
      `First database tree item should have label "admin" found ${connectionsItems[0].label}.`
    );
  });

  test('caches the expanded state of databases in the tree when a connection is expanded or collapsed', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const connectionsItems = await treeController.getChildren();

    // Expand the connection.
    const testConnectionTreeItem = connectionsItems[0];

    await testConnectionTreeItem.onDidExpand();

    const databaseItems = await testConnectionTreeItem.getChildren();

    assert(
      databaseItems[1].isExpanded === false,
      'Expected database tree item not to be expanded on default.'
    );

    // Expand the first database item.
    await databaseItems[1].onDidExpand();

    assert(
      databaseItems[1].isExpanded === true,
      'Expected database tree item be expanded.'
    );

    // Collapse the connection.
    testConnectionTreeItem.onDidCollapse();

    const databaseTreeItems = await testConnectionTreeItem.getChildren();

    assert(
      databaseTreeItems.length === 0,
      `Expected the connection tree to return no children when collapsed, found ${databaseTreeItems.length}`
    );

    testConnectionTreeItem.onDidExpand();

    const newDatabaseItems = await testConnectionTreeItem.getChildren();

    assert(
      newDatabaseItems[1].isExpanded === true,
      'Expected database tree to be expanded from cache.'
    );
  });

  test('tree view should be not created by default (shows welcome view)', () => {
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;

    assert(testExplorerController.getConnectionsTreeView() === undefined);
  });

  test('tree view should call create tree view after a "CONNECTIONS_DID_CHANGE" event', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;

    testExplorerController.activateConnectionsTreeView();

    const treeControllerStub = sinon.stub().returns(null);

    sinon.replace(
      testExplorerController.getTreeController(),
      'activateTreeViewEventHandlers',
      treeControllerStub
    );

    const vscodeCreateTreeViewStub = sinon.stub().returns('');

    sinon.replace(vscode.window, 'createTreeView', vscodeCreateTreeViewStub);

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.disconnect();

    assert(vscodeCreateTreeViewStub.called);
  });
});
