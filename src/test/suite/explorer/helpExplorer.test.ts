import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import assert from 'assert';
import sinon from 'sinon';

import { HelpExplorer } from '../../../explorer';
import * as linkHelper from '../../../utils/linkHelper';
import { mdbTestExtension } from '../stubbableMdbExtension';

suite('Help Explorer Test Suite', function () {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    mdbTestExtension.testExtensionController._helpExplorer.deactivate();
    sandbox.restore();
  });

  test('tree view should be not created until it is activated', () => {
    const testHelpExplorer = new HelpExplorer(
      mdbTestExtension.testExtensionController._telemetryService
    );
    assert(testHelpExplorer._treeView === undefined);
    testHelpExplorer.activateHelpTreeView();
    assert(testHelpExplorer._treeView !== undefined);
  });

  test('the tree should have 5 help tree items', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;
    testHelpExplorer.activateHelpTreeView();
    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    assert(helpTreeItems.length === 6);
  });

  test('the tree should have an atlas item with a url and atlas icon', async () => {
    const testHelpExplorer =
      mdbTestExtension.testExtensionController._helpExplorer;
    testHelpExplorer.activateHelpTreeView();
    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[5];

    assert.strictEqual(atlasHelpItem.label, 'Create Free Atlas Cluster');
    assert.strictEqual(atlasHelpItem.url.includes('mongodb.com'), true);
    const { anonymousId } =
      mdbTestExtension.testExtensionController._telemetryService.userIdentity;
    assert.strictEqual(
      new URL(atlasHelpItem.url).searchParams.get('ajs_aid'),
      anonymousId
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

    testHelpExplorer.activateHelpTreeView();

    const stubExecuteCommand = sandbox.fake();
    sandbox.replace(vscode.commands, 'executeCommand', stubExecuteCommand);
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

    testHelpExplorer.activateHelpTreeView();

    const stubExecuteCommand = sandbox.fake();
    sandbox.replace(linkHelper, 'openLink', stubExecuteCommand);
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

    const stubTrackTelemetry = sandbox.fake();
    sandbox.replace(
      mdbTestExtension.testExtensionController._telemetryService,
      'track',
      stubTrackTelemetry
    );
    testHelpExplorer.activateHelpTreeView();

    sandbox.replace(vscode.commands, 'executeCommand', sandbox.fake());
    const helpTreeItems = await testHelpExplorer._treeController.getChildren();
    const atlasHelpItem = helpTreeItems[5];
    void testHelpExplorer._treeController.onClickHelpItem(
      atlasHelpItem,
      mdbTestExtension.testExtensionController._telemetryService
    );
    assert(stubTrackTelemetry.called);
    assert(
      stubTrackTelemetry.firstCall.args[0].properties.screen === 'helpPanel'
    );
    assert(
      stubTrackTelemetry.firstCall.args[0].properties.link_id ===
        'freeClusterCTA'
    );
  });
});
