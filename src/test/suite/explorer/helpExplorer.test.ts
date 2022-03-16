import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import assert from 'assert';
import sinon from 'sinon';

import { HelpExplorer } from '../../../explorer';
import * as linkHelper from '../../../utils/linkHelper';
import { mdbTestExtension } from '../stubbableMdbExtension';

suite('Help Explorer Test Suite', function () {
  afterEach(() => {
    sinon.restore();
    mdbTestExtension.testExtensionController._helpExplorer.deactivate();
  });

  test('tree view should be not created until it is activated', () => {
    const testHelpExplorer = new HelpExplorer();
    assert(testHelpExplorer._treeView === undefined);
    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryService
    );
    assert(testHelpExplorer._treeView !== undefined);
  });

  test('the tree should have 5 help tree items', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;
    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryService
    );
    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    assert(helpTreeItems.length === 6);
  });

  test('the tree should have an atlas item with a url and atlas icon', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;
    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryService
    );
    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[5];

    assert.strictEqual(atlasHelpItem.label, 'Create Free Atlas Cluster');
    const telemetryUserIdentity = mdbTestExtension.testExtensionController._telemetryService.getTelemetryUserIdentity();
    assert.strictEqual(
      atlasHelpItem.url,
      `https://mongodb.com/products/vs-code/vs-code-atlas-signup?utm_campaign=vs-code-extension&utm_source=visual-studio&utm_medium=product&ajs_aid=${telemetryUserIdentity[0]}`
    );
    assert.strictEqual(atlasHelpItem.iconName, 'atlas');
    assert.strictEqual(atlasHelpItem.linkId, 'freeClusterCTA');
    assert(atlasHelpItem.useRedirect === true);
    // The assert below is a bit redundant but will prevent us from redirecting to a non-https URL by mistake
    assert(atlasHelpItem.url.startsWith('https://') === true);
  });

  test('when a help item that does not require a redirect is clicked on it should open the url with vscode', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;

    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryService
    );

    const stubExecuteCommand = sinon.fake();
    sinon.replace(vscode.commands, 'executeCommand', stubExecuteCommand);
    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[1];
    void testHelpExplorer._treeController.onClickHelpItem(
      atlasHelpItem,
      mdbTestExtension.testExtensionController._telemetryService
    );
    assert(stubExecuteCommand.called);
    assert(stubExecuteCommand.firstCall.args[0] === 'vscode.open');
    assert(
      stubExecuteCommand.firstCall.args[1].path ===
      vscode.Uri.parse(atlasHelpItem.url).path
    );
    assert(
      stubExecuteCommand.firstCall.args[1].authority ===
      vscode.Uri.parse(atlasHelpItem.url).authority
    );
  });

  test('when a help item that requires a redirect is clicked on it should open the url with the link helper', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;

    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryService
    );

    const stubExecuteCommand = sinon.fake();
    sinon.replace(linkHelper, 'openLink', stubExecuteCommand);
    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[5];
    void testHelpExplorer._treeController.onClickHelpItem(
      atlasHelpItem,
      mdbTestExtension.testExtensionController._telemetryService
    );
    assert(stubExecuteCommand.called);
    assert(stubExecuteCommand.firstCall.args[0] === atlasHelpItem.url);
  });

  test('when a help item is clicked on it should have a telemetry trackLinkClicked event', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;

    const stubLinkClickedTelemetry = sinon.fake();
    sinon.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'trackLinkClicked',
      stubLinkClickedTelemetry
    );
    testHelpExplorer.activateHelpTreeView(
      mdbTestExtension.testExtensionController._telemetryService
    );

    sinon.replace(vscode.commands, 'executeCommand', sinon.fake());
    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[5];
    void testHelpExplorer._treeController.onClickHelpItem(
      atlasHelpItem,
      mdbTestExtension.testExtensionController._telemetryService
    );
    assert(stubLinkClickedTelemetry.called);
    assert(stubLinkClickedTelemetry.firstCall.args[0] === 'helpPanel');
    assert(stubLinkClickedTelemetry.firstCall.args[1] === 'freeClusterCTA');
  });
});
