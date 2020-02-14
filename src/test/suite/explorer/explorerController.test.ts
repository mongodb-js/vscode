import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, after } from 'mocha';
import mongodbRunnerMochaBefore = require('mongodb-runner/mocha/before');
import mongodbRunnerMochaAfter = require('mongodb-runner/mocha/after');

import ConnectionController from '../../../connectionController';
import { ExplorerController } from '../../../explorer';
import { StatusView } from '../../../views';

const testDatabaseURI = 'mongodb://localhost';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

suite('Explorer Controller Test Suite', function() {
  vscode.window.showInformationMessage('Starting tests...');

  before(mongodbRunnerMochaBefore);
  after(mongodbRunnerMochaAfter);

  test('when activated it creates a tree with a connections root', async function() {
    const testConnectionController = new ConnectionController(new StatusView());

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');
    if (treeController) {
      const treeControllerChildren = await treeController.getChildren();

      assert(
        treeControllerChildren.length === 1,
        `Tree controller should have 1 child, found ${treeControllerChildren.length}`
      );
      assert(
        treeControllerChildren[0].label === 'Connections',
        'Tree controller should have a "Connections" child'
      );
    }

    testExplorerController.deactivate();
  });

  test('when refreshed it updates the connections to account for a change in the connection controller', async function() {
    try {
      const testConnectionController = new ConnectionController(
        new StatusView()
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

      // Here we silently update the connections (maybe simulating a bug).
      testConnectionController.setConnnectingInstanceId(
        mockConnectionInstanceId
      );
      testConnectionController.setConnnecting(true);

      // Ensure the tree didn't update yet because it was a silent update.
      let treeControllerChildren = await treeController.getChildren();
      let connectionsItems = await treeControllerChildren[0].getChildren();
      assert(
        connectionsItems.length === 0,
        'Expected there not to be any connection tree items'
      );

      treeController.refresh();

      treeControllerChildren = await treeController.getChildren();
      connectionsItems = await treeControllerChildren[0].getChildren();
      assert(
        connectionsItems.length === 1,
        `Expected there be 1 connection tree item, found ${connectionsItems.length}`
      );
      assert(
        connectionsItems[0].label === 'testInstanceId',
        'There should be a connection tree item with the label "testInstanceId"'
      );

      testExplorerController.deactivate();
    } catch (err) {
      assert(false, 'Expected test not to error and it errored');
    }
  });

  test('when a connection is added and connected it is added to the tree and expanded', function(done) {
    const testConnectionController = new ConnectionController(new StatusView());

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
                connectionsItems[0].getIsExpanded(),
                'Expected the connection tree item to be expanded'
              );

              testExplorerController.deactivate();
            })
            .then(() => done(), done);
        });
      });
  });

  test('only one activate connection is displayed as connected in the tree', function(done) {
    const testConnectionController = new ConnectionController(new StatusView());

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    if (!treeController) {
      assert(!!treeController, 'Tree controller should not be undefined');
      return;
    }

    this.timeout(1500);

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

        // This will timeout in 1s, which is enough time for us to just check.
        testConnectionController.addNewConnectionAndConnect(
          testDatabaseURI2WithTimeout
        );

        treeController.getChildren().then(treeControllerChildren => {
          treeControllerChildren[0]
            .getChildren()
            .then(connectionsItems => {
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
                connectionsItems[0].getIsExpanded() === false,
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
            .then(() => done(), done);
        });
      });
  });

  test('shows the databases of connected connection in tree', function(done) {
    const testConnectionController = new ConnectionController(new StatusView());
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
                  databaseItems.length === 3,
                  `Expected there be 3 database tree items, found ${databaseItems.length}`
                );
                assert(
                  databaseItems[0].label === 'admin',
                  `First database tree item should have label "admin" found ${connectionsItems[0].label}.`
                );

                testExplorerController.deactivate();
              })
              .then(() => done(), done);
          });
        });
      });
  });
});
