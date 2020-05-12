import * as assert from 'assert';
import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import Connection = require('mongodb-connection-model/lib/model');
import * as sinon from 'sinon';

import {
  DefaultSavingLocations,
  StorageScope
} from '../../../storage/storageController';

import { TEST_DATABASE_URI } from '../dbTestHelper';
import { mdbTestExtension } from '../stubbableMdbExtension';

const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=500&serverSelectionTimeoutMS=500';

suite('Explorer Controller Test Suite', () => {
  beforeEach(async () => {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('sendTelemetry', false);
    // Don't save connections on default.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations['Session Only']
      );
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
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    sinon.restore();
  });

  test('should have a connections root', (done) => {
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');
    treeController
      .getChildren()
      .then((treeControllerChildren) => {
        assert(
          treeControllerChildren.length === 1,
          `Tree controller should have 1 child, found ${treeControllerChildren.length}`
        );
        assert(
          treeControllerChildren[0].label === 'Connections',
          'Tree controller should have a "Connections" child'
        );
      })
      .then(done, done);
  });

  test('it updates the connections to account for a change in the connection controller', (done) => {
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

    treeController.getChildren().then((treeControllerChildren) => {
      treeControllerChildren[0]
        .getChildren()
        .then((connectionsItems) => {
          assert(
            connectionsItems.length === 1,
            `Expected there to be 1 connection tree item, found ${connectionsItems.length}`
          );
          assert(
            connectionsItems[0].label === 'testConnectionName',
            'There should be a connection tree item with the label "testConnectionName"'
          );
          testExplorerController.deactivate();
        })
        .then(done, done);
    });
  });

  test('when a connection is added and connected it is added to the tree and expanded', (done) => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then((succesfullyConnected) => {
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
          `Expected active connection to be '${
            Object.keys(testConnectionController._connections)[0]
          }' found ${activeId}`
        );

        treeController.getChildren().then((treeControllerChildren) => {
          treeControllerChildren[0]
            .getChildren()
            .then((connectionsItems) => {
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
              assert(
                connectionsItems[0].isExpanded,
                'Expected the connection tree item to be expanded'
              );

              testExplorerController.deactivate();
            })
            .then(done, done);
        });
      });
  });

  test('only the active connection is displayed as connected in the tree', (done) => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then((succesfullyConnected) => {
        assert(
          succesfullyConnected === true,
          'Expected a successful connection response.'
        );
        assert(
          Object.keys(testConnectionController._connections).length === 1,
          'Expected there to be 1 connection in the connection list.'
        );
        const connectionId =
          testConnectionController.getActiveConnectionId() || '';
        const connectionName =
          testConnectionController._connections[connectionId].name;
        assert(
          connectionName === 'localhost:27018',
          `Expected active connection name to be 'localhost:27018' found ${connectionName}`
        );

        // This will timeout in 500ms, which is enough time for us to just check.
        testConnectionController
          .addNewConnectionStringAndConnect(testDatabaseURI2WithTimeout)
          .then(
            () => {},
            () => {} /* Silent fail (should fail) */
          );

        setTimeout(() => {
          treeController.getChildren().then((treeControllerChildren) => {
            treeControllerChildren[0]
              .getChildren()
              .then((connectionsItems) => {
                assert(
                  connectionsItems.length === 2,
                  `Expected there be 2 connection tree item, found ${connectionsItems.length}`
                );
                assert(
                  connectionsItems[0].label === 'localhost:27018',
                  `First connection tree item should have label "localhost:27018" found ${connectionsItems[0].label}`
                );
                assert(
                  connectionsItems[0].description === '',
                  `Expected the first connection to have no description, found ${connectionsItems[0].description}.`
                );
                assert(
                  connectionsItems[0].isExpanded === false,
                  'Expected the first connection tree item to not be expanded'
                );
                assert(
                  connectionsItems[1].label === 'shouldfail:27017',
                  'Second connection tree item should have label "shouldfail:27017"'
                );
                assert(
                  connectionsItems[1].description === 'connecting...',
                  'The second connection should have a connecting description.'
                );

                testExplorerController.deactivate();
              })
              .then(done, done);
          });
        }, 500);
      });
  });

  test('shows the databases of connected connection in tree', (done) => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(() => {
        treeController.getChildren().then((treeControllerChildren) => {
          treeControllerChildren[0].getChildren().then((connectionsItems) => {
            // Expand the connection.
            treeControllerChildren[0].onDidExpand();

            connectionsItems[0]
              .getChildren()
              .then((databaseItems) => {
                assert(
                  databaseItems.length >= 3,
                  `Expected there be 3 or more database tree items, found ${databaseItems.length}`
                );
                assert(
                  databaseItems[0].label === 'admin',
                  `First database tree item should have label "admin" found ${connectionsItems[0].label}.`
                );

                testExplorerController.deactivate();
              })
              .then(done, done);
          });
        });
      });
  });

  test('caches the expanded state of databases in the tree when a connection is expanded or collapsed', (done) => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(() => {
        treeController.getChildren().then((rootTreeItem) => {
          const connectionsTreeItem = rootTreeItem[0];
          connectionsTreeItem.getChildren().then((connectionsItems) => {
            // Expand the connection.
            const testConnectionTreeItem = connectionsItems[0];
            testConnectionTreeItem.onDidExpand().then(() => {
              testConnectionTreeItem.getChildren().then((databaseItems) => {
                assert(
                  databaseItems[1].isExpanded === false,
                  'Expected database tree item not to be expanded on default.'
                );

                // Expand the first database item.
                databaseItems[1].onDidExpand().then(() => {
                  assert(
                    databaseItems[1].isExpanded === true,
                    'Expected database tree item be expanded.'
                  );

                  // Collapse the connection.
                  testConnectionTreeItem.onDidCollapse();

                  testConnectionTreeItem
                    .getChildren()
                    .then((databaseTreeItems) => {
                      assert(
                        databaseTreeItems.length === 0,
                        `Expected the connection tree to return no children when collapsed, found ${databaseTreeItems.length}`
                      );

                      testConnectionTreeItem.onDidExpand();
                      testConnectionTreeItem
                        .getChildren()
                        .then((newDatabaseItems) => {
                          assert(
                            newDatabaseItems[1].isExpanded === true,
                            'Expected database tree to be expanded from cache.'
                          );

                          testExplorerController.deactivate();
                        })
                        .then(done, done);
                    });
                });
              });
            });
          });
        });
      });
  });

  test('tree view should be not created by default (shows welcome view)', () => {
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;

    assert(testExplorerController.getTreeView() === undefined);
  });

  test('tree view should call create tree view after a "CONNECTIONS_DID_CHANGE" event', (done) => {
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;

    testExplorerController.activateTreeView();

    const treeControllerStub = sinon.stub().returns();
    sinon.replace(
      testExplorerController.getTreeController(),
      'activateTreeViewEventHandlers',
      treeControllerStub
    );

    const vscodeCreateTreeViewStub = sinon.stub().returns('');
    sinon.replace(vscode.window, 'createTreeView', vscodeCreateTreeViewStub);

    mdbTestExtension.testExtensionController._connectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(() => {
        mdbTestExtension.testExtensionController._connectionController.disconnect();
        assert(vscodeCreateTreeViewStub.called);
      })
      .then(done);
  });
});
