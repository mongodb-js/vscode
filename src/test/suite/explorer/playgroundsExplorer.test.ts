import assert from 'assert';
import * as vscode from 'vscode';
import { before, afterEach } from 'mocha';
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
        excludeFromPlaygroundsSearchDefault
      );
  });

  test('should show a welcome view if playgrounds list is empty', async () => {
    const treeController = testPlaygroundsExplorer.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');

    try {
      const treeControllerChildren = await treeController.getChildren();

      assert(
        treeControllerChildren.length === 0,
        `Tree controller should have 0 child, found ${treeControllerChildren.length}`
      );
    } catch (error) {
      assert(false, error as Error);
    }
  });

  test('should search for playground in the workspace', async () => {
    const workspaceFolders = (vscode.workspace.workspaceFolders || []).filter(
      (folder) => folder.uri.scheme === 'file'
    );
    const rootPath = workspaceFolders[0]?.uri.path.replace('/out/test', '');
    const rootUri = vscode.Uri.parse(rootPath);
    const treeController = testPlaygroundsExplorer.getTreeController();

    try {
      const children = await treeController.getPlaygrounds(rootUri);

      assert.strictEqual(Object.keys(children).length, 7);

      const playgrounds = Object.values(children).filter(
        (item: any) => item.label && item.label.split('.').pop() === 'mongodb'
      );

      assert.strictEqual(Object.keys(playgrounds).length, 7);
    } catch (error) {
      assert(false, error as Error);
    }
  });

  test('should exclude folders and files specified in extension settings', async () => {
    const workspaceFolders = (vscode.workspace.workspaceFolders || []).filter(
      (folder) => folder.uri.scheme === 'file'
    );
    const rootPath = workspaceFolders[0]?.uri.path.replace('/out/test', '');
    const rootUri = vscode.Uri.parse(rootPath);

    try {
      await vscode.workspace
        .getConfiguration('mdb')
        .update(
          'excludeFromPlaygroundsSearch',
          excludeFromPlaygroundsSearchDefault.concat(['**/playgrounds/**'])
        );

      const treeController = new PlaygroundsTree();
      const children = await treeController.getPlaygrounds(rootUri);

      assert.strictEqual(Object.keys(children).length, 3);
    } catch (error) {
      assert(false, error as Error);
    }
  });

  test('should fetch new folders and files to exclude after refreshing', async () => {
    try {
      const treeController = new PlaygroundsTree();

      assert(
        !treeController.excludeFromPlaygroundsSearch.includes(
          '**/playgrounds/**'
        )
      );

      await vscode.workspace
        .getConfiguration('mdb')
        .update(
          'excludeFromPlaygroundsSearch',
          excludeFromPlaygroundsSearchDefault.concat(['**/playgrounds/**'])
        );
      await treeController.refresh();

      assert(
        treeController.excludeFromPlaygroundsSearch.includes(
          '**/playgrounds/**'
        )
      );
    } catch (error) {
      assert(false, error as Error);
    }
  });
});
