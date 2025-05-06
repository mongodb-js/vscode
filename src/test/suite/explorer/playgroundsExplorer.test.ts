import assert from 'assert';
import * as vscode from 'vscode';
import { before, afterEach } from 'mocha';
import path from 'path';
import { mdbTestExtension } from '../stubbableMdbExtension';
import PlaygroundsTree from './../../../explorer/playgroundsTree';

suite('Playgrounds Controller Test Suite', function () {
  this.timeout(10000);
  const testPlaygroundsExplorer =
    mdbTestExtension.testExtensionController._playgroundsExplorer;
  let excludeFromPlaygroundsSearchDefault: string[];

  before(async () => {
    excludeFromPlaygroundsSearchDefault =
      (await vscode.workspace
        .getConfiguration('mdb')
        .get('excludeFromPlaygroundsSearch')) || [];
  });

  afterEach(async () => {
    await vscode.workspace
      .getConfiguration('mdb')
      .update(
        'excludeFromPlaygroundsSearch',
        excludeFromPlaygroundsSearchDefault,
      );
  });

  test('should show a welcome view if playgrounds list is empty', async () => {
    const treeController = testPlaygroundsExplorer.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');

    try {
      const treeControllerChildren = await treeController.getChildren();

      assert(
        treeControllerChildren.length === 0,
        `Tree controller should have 0 child, found ${treeControllerChildren.length}`,
      );
    } catch (error) {
      assert(false, error as Error);
    }
  });

  test('should search for playground in the workspace', async () => {
    const treeController = testPlaygroundsExplorer.getTreeController();

    try {
      const rootPath = path.resolve(__dirname, '../../../..');
      const children = await treeController.getPlaygrounds(rootPath);

      // The number of playground files in the project repository.
      assert.strictEqual(Object.keys(children).length, 8);
    } catch (error) {
      assert(false, error as Error);
    }
  });

  test('should exclude folders and files specified in extension settings', async () => {
    const treeController = new PlaygroundsTree();

    try {
      await vscode.workspace
        .getConfiguration('mdb')
        .update(
          'excludeFromPlaygroundsSearch',
          excludeFromPlaygroundsSearchDefault.concat(['**/playgrounds/**']),
        );
      const rootPath = path.resolve(__dirname, '../../../..');
      const children = await treeController.getPlaygrounds(rootPath);

      // The number of playground files in the project repository,
      // excluding the ./playgrounds directory.
      assert.strictEqual(Object.keys(children).length, 4);
    } catch (error) {
      assert(false, error as Error);
    }
  });

  test('should fetch new folders and files to exclude after refreshing', async () => {
    try {
      const treeController = new PlaygroundsTree();

      assert(
        !treeController.excludeFromPlaygroundsSearch.includes(
          '**/playgrounds/**',
        ),
      );

      await vscode.workspace
        .getConfiguration('mdb')
        .update(
          'excludeFromPlaygroundsSearch',
          excludeFromPlaygroundsSearchDefault.concat(['**/playgrounds/**']),
        );
      await treeController.refresh();

      assert(
        treeController.excludeFromPlaygroundsSearch.includes(
          '**/playgrounds/**',
        ),
      );
    } catch (error) {
      assert(false, error as Error);
    }
  });
});
