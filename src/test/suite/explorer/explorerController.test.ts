import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, after } from 'mocha';

import ConnectionController from '../../../connectionController';
import { ExplorerController } from '../../../explorer';
import { StatusView } from '../../../views';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';

const testDatabaseURI = 'mongodb://localhost';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

suite('Explorer Controller Test Suite', function () {
  vscode.window.showInformationMessage('Starting tests...');

  before(require('mongodb-runner/mocha/before'));
  after(require('mongodb-runner/mocha/after'));

  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

  test('when activated it creates a tree with a connections root', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');
    if (treeController) {
      treeController.getChildren().then(treeControllerChildren => {
        assert(
          treeControllerChildren.length === 1,
          `Tree controller should have 1 child, found ${treeControllerChildren.length}`
        );
        assert(
          treeControllerChildren[0].label === 'Connections',
          'Tree controller should have a "Connections" child'
        );
      }).then(done, done);
    } else {
      done();
    }

    testExplorerController.deactivate();
  });

  test('it updates the connections to account for a change in the connection controller', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    if (!treeController) {
      // Shouldn't get here so this should fail.
      assert(!!treeController, 'Tree controller should not be undefined');
      return;
    }

    const mockConnectionInstanceId = 'testInstanceId';

    testConnectionController.setConnnectingInstanceId(
      mockConnectionInstanceId
    );
    testConnectionController.setConnnecting(true);

    // Ensure the tree didn't update yet because it was a silent update.
    treeController.getChildren().then(treeControllerChildren => {
      treeControllerChildren[0].getChildren().then(connectionsItems => {
        assert(
          connectionsItems.length === 1,
          `Expected there to be 1 connection tree item, found ${connectionsItems.length}`
        );
        assert(
          connectionsItems[0].label === 'testInstanceId',
          'There should be a connection tree item with the label "testInstanceId"'
        );
        testExplorerController.deactivate();
      }).then(done, done);
    });
  });

  test('when a connection is added and connected it is added to the tree and expanded', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    if (!treeController) {
      assert(!!treeController, 'Tree controller should not be undefined');
      return;
    }

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful connection response.'
        );
        assert(
          Object.keys(testConnectionController.getConnections()).length === 1,
          'Expected there to be 1 connection in the connection list.'
        );
        const instanceId = testConnectionController.getActiveConnectionInstanceId();
        assert(
          instanceId === 'localhost:27017',
          `Expected active connection to be 'localhost:27017' found ${instanceId}`
        );

        treeController.getChildren().then(treeControllerChildren => {
          treeControllerChildren[0]
            .getChildren()
            .then(connectionsItems => {
              assert(
                connectionsItems.length === 1,
                `Expected there be 1 connection tree item, found ${connectionsItems.length}`
              );
              assert(
                connectionsItems[0].label === 'localhost:27017',
                'There should be a connection tree item with the label "localhost:27017"'
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

  test('only the active connection is displayed as connected in the tree', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    if (!treeController) {
      assert(!!treeController, 'Tree controller should not be undefined');
      return;
    }

    this.timeout(1500);

    testConnectionController.addNewConnectionAndConnect(testDatabaseURI).then(succesfullyConnected => {
      assert(succesfullyConnected === true, 'Expected a successful connection response.');
      assert(
        Object.keys(testConnectionController.getConnections()).length === 1,
        'Expected there to be 1 connection in the connection list.'
      );
      const instanceId = testConnectionController.getActiveConnectionInstanceId();
      assert(
        instanceId === 'localhost:27017',
        `Expected active connection to be 'localhost:27017' found ${instanceId}`
      );

      // This will timeout in 1s, which is enough time for us to just check.
      testConnectionController.addNewConnectionAndConnect(testDatabaseURI2WithTimeout);

      treeController.getChildren().then(treeControllerChildren => {
        treeControllerChildren[0].getChildren().then(connectionsItems => {
          assert(
            connectionsItems.length === 2,
            `Expected there be 2 connection tree item, found ${connectionsItems.length}`
          );
          assert(
            connectionsItems[0].label === 'localhost:27017',
            `First connection tree item should have label "localhost:27017" found ${connectionsItems[0].label}`
          );
          assert(
            connectionsItems[0].description === '',
            'Expected the first connection to have no description.'
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
        }).then(done, done);
      });
    });
  });

  test('shows the databases of connected connection in tree', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );
    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    if (!treeController) {
      assert(!!treeController, 'Tree controller should not be undefined');
      return;
    }

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(() => {
        treeController.getChildren().then(treeControllerChildren => {
          treeControllerChildren[0].getChildren().then(connectionsItems => {
            // Expand the connection.
            treeControllerChildren[0].onDidExpand();

            connectionsItems[0]
              .getChildren()
              .then((databaseItems: any) => {
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

  test('caches the expanded state of databases in the tree when a connection is expanded or collapsed', function (done) {
    const testConnectionController = new ConnectionController(new StatusView());

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    if (!treeController) {
      assert(!!treeController, 'Tree controller should not be undefined');
      return;
    }

    testConnectionController.addNewConnectionAndConnect(testDatabaseURI).then(() => {
      treeController.getChildren().then(rootTreeItem => {
        const connectionsTreeItem = rootTreeItem[0];
        connectionsTreeItem.getChildren().then(connectionsItems => {
          // Expand the connection.
          const testConnectionTreeItem = connectionsItems[0];
          testConnectionTreeItem.onDidExpand().then(() => {
            testConnectionTreeItem.getChildren().then((databaseItems: any) => {
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

                testConnectionTreeItem.getChildren().then((databaseTreeItems: any) => {
                  assert(
                    databaseTreeItems.length === 0,
                    `Expected the connection tree to return no children when collapsed, found ${databaseTreeItems.length}`
                  );

                  testConnectionTreeItem.onDidExpand();
                  testConnectionTreeItem.getChildren().then((newDatabaseItems: any) => {
                    assert(
                      newDatabaseItems[1].isExpanded === true,
                      'Expected database tree to be expanded from cache.'
                    );

                    testExplorerController.deactivate();
                  }).then(done, done);
                });
              });
            });
          });
        });
      });
    });
  });
});
