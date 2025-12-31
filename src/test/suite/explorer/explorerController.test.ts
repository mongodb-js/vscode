import * as vscode from 'vscode';
import { expect } from 'chai';
import { beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { connect, createConnectionAttempt } from 'mongodb-data-service';
import { mongoLogId } from 'mongodb-log-writer';

import {
  DefaultSavingLocation,
  SecretStorageLocation,
  StorageLocation,
} from '../../../storage/storageController';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { createLogger } from '../../../logging';

const log = createLogger('test explorer controller');

const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=500&serverSelectionTimeoutMS=500';

suite('Explorer Controller Test Suite', function () {
  // Longer timeout, sometimes it takes a few seconds for vscode to
  // load the extension before running tests.
  this.timeout(10000);
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    // Don't save connections on default.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.sessionOnly,
      );
    sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.stub(vscode.window, 'showErrorMessage');
    sandbox.stub(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackNewConnection',
    );
  });

  afterEach(async () => {
    // Unset the variable we set in `beforeEach`.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocation.workspace,
      );
    // Reset our connections.
    await mdbTestExtension.testExtensionController._connectionController.disconnect();
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    mdbTestExtension.testExtensionController._explorerController.deactivate();
    sandbox.restore();
  });

  test('it updates the connections to account for a change in the connection controller', async function () {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    testConnectionController._connections = {
      testConnectionId: {
        id: 'testConnectionId',
        connectionOptions: { connectionString: 'mongodb://localhost' },
        name: 'testConnectionName',
        storageLocation: StorageLocation.none,
        secretStorageLocation: SecretStorageLocation.SecretStorage,
      },
    };
    testConnectionController._connectionAttempt = createConnectionAttempt({
      connectFn: connect,
      logger: Object.assign(log, { mongoLogId }),
      proxyOptions: {},
    });

    const connectionsItems = await treeController.getChildren();

    expect(connectionsItems).to.have.lengthOf(1);
    expect(connectionsItems[0].label).to.equal('testConnectionName');
  });

  test('when a connection is added and connected it is added to the tree', async function () {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

    expect(succesfullyConnected).to.be.true;

    expect(Object.keys(testConnectionController._connections).length).to.equal(
      1,
    );

    const activeId = testConnectionController.getActiveConnectionId();

    expect(activeId).to.equal(
      Object.keys(testConnectionController._connections)[0],
    );

    const connectionsItems = await treeController.getChildren();

    expect(connectionsItems.length).to.equal(1);
    expect(connectionsItems[0].label).to.equal('localhost:27088');
    expect(connectionsItems[0].description).to.equal('connected');
  });

  test('only the active connection is displayed as connected in the tree', async function () {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: TEST_DATABASE_URI,
      });

    expect(succesfullyConnected).to.be.true;
    expect(Object.keys(testConnectionController._connections).length).to.equal(
      1,
    );

    const connectionId = testConnectionController.getActiveConnectionId() || '';
    const connectionName =
      testConnectionController._connections[connectionId].name;

    const connectionsItemsFirstConnect = await treeController.getChildren();

    expect(connectionName).to.equal('localhost:27088');
    // Ensure we auto expand when it's successfully connected to.
    expect(connectionsItemsFirstConnect[0].isExpanded).to.be.true;

    try {
      await testConnectionController.addNewConnectionStringAndConnect({
        connectionString: testDatabaseURI2WithTimeout,
      });
    } catch (error) {
      /* Silent fail (should fail) */
    }

    const connectionsItems = await treeController.getChildren();

    expect(connectionsItems.length).to.equal(2);
    expect(connectionsItems[0].label).to.equal('localhost:27088');
    expect(connectionsItems[0].isExpanded).to.be.false;
    expect(connectionsItems[1].label).to.equal('shouldfail');
  });

  test('shows connection names sorted alphabetically in the tree', async function () {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const connectionId = testConnectionController.getActiveConnectionId() || '';

    testConnectionController._connections.aaa = {
      connectionOptions:
        testConnectionController._connections[connectionId].connectionOptions,
      name: 'aaa',
      id: 'aaa',
      storageLocation: StorageLocation.workspace,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
    };

    testConnectionController._connections.zzz = {
      connectionOptions:
        testConnectionController._connections[connectionId].connectionOptions,
      name: 'zzz',
      id: 'zzz',
      storageLocation: StorageLocation.workspace,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
    };

    const connectionsItems = await treeController.getChildren();

    expect(connectionsItems.length).to.equal(3);
    expect(connectionsItems[0].label).to.equal('aaa');
    expect(connectionsItems[2].label).to.equal('zzz');

    testConnectionController._connections.zzz.name = '111';

    const afterAdditionConnectionsItems = await treeController.getChildren();

    expect(afterAdditionConnectionsItems[0].label).to.equal('111');
  });

  test('shows the databases of connected connection in tree', async function () {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const connectionsItems = await treeController.getChildren();
    const databaseItems = await connectionsItems[0].getChildren();

    expect(databaseItems.length).to.be.at.least(3);
    expect(databaseItems[0].label).to.equal('admin');
  });

  test('caches the expanded state of databases in the tree when a connection is expanded or collapsed', async function () {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });

    const connectionsItems = await treeController.getChildren();

    // Expand the connection.
    const testConnectionTreeItem = connectionsItems[0];

    await testConnectionTreeItem.onDidExpand();

    const databaseItems = await testConnectionTreeItem.getChildren();

    expect(databaseItems[1].isExpanded).to.be.false;

    // Expand the first database item.
    await databaseItems[1].onDidExpand();

    expect(databaseItems[1].isExpanded).to.be.true;

    // Collapse the connection.
    testConnectionTreeItem.onDidCollapse();

    const databaseTreeItems = await testConnectionTreeItem.getChildren();

    expect(databaseTreeItems.length).to.equal(0);

    testConnectionTreeItem.onDidExpand();

    const newDatabaseItems = await testConnectionTreeItem.getChildren();

    expect(newDatabaseItems[1].isExpanded).to.be.true;
  });

  test('tree view should be not created by default (shows welcome view)', function () {
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;

    expect(testExplorerController.getConnectionsTreeView()).to.be.undefined;
  });

  test('tree view should call create tree view after a "CONNECTIONS_DID_CHANGE" event', async function () {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;

    testExplorerController.activateConnectionsTreeView();

    const treeControllerStub = sandbox.stub().returns(null);

    sandbox.replace(
      testExplorerController.getTreeController(),
      'activateTreeViewEventHandlers',
      treeControllerStub,
    );

    const vscodeCreateTreeViewStub = sandbox.stub().returns('');

    sandbox.replace(vscode.window, 'createTreeView', vscodeCreateTreeViewStub);

    await testConnectionController.addNewConnectionStringAndConnect({
      connectionString: TEST_DATABASE_URI,
    });
    await testConnectionController.disconnect();

    expect(vscodeCreateTreeViewStub.called).to.be.true;
  });
});
