import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
const sinon = require('sinon');

import { mdbTestExtension } from '../stubbableMdbExtension';
import HelpTree from '../../../explorer/helpTree';

suite('Help Explorer Test Suite', function () {
  afterEach(() => {
    sinon.restore();
    mdbTestExtension.testExtensionController._helpExplorer.deactivate();
  });

  test('tree view should be not created until it is activated', () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;

    assert(testHelpExplorer._treeView === undefined);

    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryController
    );

    assert(testHelpExplorer._treeView !== undefined);
  });

  test('the tree should have 5 help tree items', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;

    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryController
    );

    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    assert(helpTreeItems.length === 6);
  });

  test('the tree should have an atlas item with a url and atlas icon', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;

    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryController
    );

    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[5];
    assert(atlasHelpItem.title === 'Create Free Atlas Cluster');
    assert(atlasHelpItem.url === 'https://www.mongodb.com/cloud/atlas/register?utm_source=vscode&utm_medium=product&utm_campaign=VS%20code%20extension');
    // assert(atlasHelpItem.iconName === 'atlas');
    assert(atlasHelpItem.linkId === 'freeClusterCTA');
  });

  test('when a help item is clicked on it should open the url with vscode', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;

    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryController
    );

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'trackLinkClicked',
      sinon.stub()
    );

    const stubExecuteCommand = sinon.stub();

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'executeCommand',
      stubExecuteCommand
    );

    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[5];

    testHelpExplorer._treeController.onClickHelpItem(
      atlasHelpItem,
      mdbTestExtension.testExtensionController._telemetryController
    );

    assert(stubExecuteCommand.called);
    assert(
      stubExecuteCommand.firstArg === 'vscode.open'
    );
    assert(
      stubExecuteCommand.secondArg === vscode.Uri.parse(atlasHelpItem.url)
    );
  });

  test('when a help item is clicked on it should have a telemetry trackLinkClicked event', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;

    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryController
    );

    const stubLinkClickedTelemetry = sinon.stub();

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'trackLinkClicked',
      stubLinkClickedTelemetry
    );

    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryController,
      'executeCommand',
      sinon.stub()
    );

    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[5];

    testHelpExplorer._treeController.onClickHelpItem(
      atlasHelpItem,
      mdbTestExtension.testExtensionController._telemetryController
    );

    assert(stubLinkClickedTelemetry.called);
    assert(
      stubLinkClickedTelemetry.firstArg === 'helpPanel'
    );
    assert(
      stubLinkClickedTelemetry.secondArg === 'freeClusterCTA'
    );
  });
});
