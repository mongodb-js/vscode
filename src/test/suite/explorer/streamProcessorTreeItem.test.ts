import * as vscode from 'vscode';
import assert from 'assert';
import type { DataService } from 'mongodb-data-service';

import StreamProcessorTreeItem from '../../../explorer/streamProcessorTreeItem';
import { DataServiceStub, mockStreamProcessors } from '../stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../../../package.json');

function getTestTreeItem(
  options?: Partial<ConstructorParameters<typeof StreamProcessorTreeItem>[0]>,
): StreamProcessorTreeItem {
  const { name, state } = mockStreamProcessors[1];
  return new StreamProcessorTreeItem({
    streamProcessorName: name,
    streamProcessorState: state,
    dataService: new DataServiceStub() as unknown as DataService,
    isExpanded: false,
    ...options,
  });
}

suite('StreamProcessorTreeItem Test Suite', () => {
  test('its context value should be in the package json', () => {
    let spRegisteredCommandInPackageJson = false;

    const testStreamProcessorTreeItem = getTestTreeItem();

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testStreamProcessorTreeItem.contextValue)) {
        spRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      spRegisteredCommandInPackageJson,
      'Expected stream processor tree item to be registered with a command in package json',
    );
  });

  test('when not expanded it does not show state', async () => {
    const testStreamProcessorTreeItem = getTestTreeItem();

    const children = await testStreamProcessorTreeItem.getChildren();
    assert.strictEqual(
      children.length,
      0,
      `Expected no state, recieved ${children.length}`,
    );
  });

  test('when expanded shows the state as a child item in tree', async () => {
    const testStreamProcessorTreeItem = getTestTreeItem();

    await testStreamProcessorTreeItem.onDidExpand();

    const children = await testStreamProcessorTreeItem.getChildren();
    assert(
      children.length === 1,
      `Expected exactly one state item to be returned, recieved ${children.length}`,
    );
    assert.strictEqual(
      children[0].label,
      `State: ${mockStreamProcessors[1].state}`,
    );
    assert.strictEqual(
      children[0].collapsibleState,
      vscode.TreeItemCollapsibleState.None,
    );
  });
});
