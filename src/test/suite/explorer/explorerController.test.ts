import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  before,
  after
} from 'mocha';

import ConnectionController from '../../../connectionController';
import { ExplorerController } from '../../../explorer';
import { StatusView } from '../../../views';

const testDatabaseURI = 'mongodb://localhost';
const testDatabaseURI_2_WithTimeout = 'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

suite('Explorer Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  before(require('mongodb-runner/mocha/before'));
  after(require('mongodb-runner/mocha/after'));

  test('when activated it creates a tree with a connections root', async function () {
    const testConnectionController = new ConnectionController(new StatusView());

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');
    if (treeController) {
      const treeControllerChildren = await treeController.getChildren();

      assert(treeControllerChildren.length === 1, `Tree controller should have 1 child, found ${treeControllerChildren.length}`);
      assert(treeControllerChildren[0].label === 'Connections', 'Tree controller should have a "Connections" child');
    }

    testExplorerController.deactivate();

    // getTreeDataProvider.getConnections
  });

  test('when refreshed it updates the connections to account for a change', function (done) {
    const testConnectionController = new ConnectionController(new StatusView());

    const testExplorerController = new ExplorerController();

    testExplorerController.activate(testConnectionController);

    const treeController = testExplorerController.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');
    done();
    // if (treeController) {
    //   const treeControllerChildren = await treeController.getChildren();

    //   assert(treeControllerChildren.length === 1, `Tree controller should have 1 child, found ${treeControllerChildren.length}`);
    //   assert(treeControllerChildren[0].label === 'Connections', 'Tree controller should have a "Connections" child');
    // }

    // testExplorerController.deactivate();


    // Here we silently update the connections (maybe simulating a bug).
    // testExplorerController.activate();

    // testConnectionController.addNewConnectionAndConnect(testDatabaseURI).then(succesfullyConnected => {
    //   assert(succesfullyConnected === true, 'Expected a successful connection response.');
    //   assert(
    //     Object.keys(testConnectionController.getConnections()).length === 1,
    //     'Expected there to be 1 connection in the connection list.'
    //   );
    //   const instanceId = testConnectionController.getActiveConnectionInstanceId();
    //   assert(
    //     instanceId === 'localhost:27017',
    //     `Expected active connection to be 'localhost:27017' found ${instanceId}`
    //   );

    // }).then(() => done(), done);
  });

  /**
   * Things we want to test:
   * - Deactivating properly deactivates.
   * - Connecting to a database adds that connection to the tree.
   * - Expanding a collection shows that collection.
   * - Expanding another connection disconnects the current connection and connects to that one.
   * - It displays a show more when there are more documents to show.
   * - Selecting the show more increases the amount of documents the collection fetchs.
   */
});
