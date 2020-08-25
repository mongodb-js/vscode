import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { mdbTestExtension } from '../stubbableMdbExtension';

suite('Playgrounds Controller Test Suite', () => {
  const testPlaygroundsExplorer =
    mdbTestExtension.testExtensionController._playgroundsExplorer;

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
      assert(false, error);
    }
  });

  test.only('should search for playground in the workspace', async () => {
    const workspaceFolders = (vscode.workspace.workspaceFolders || []).filter(
      (folder) => folder.uri.scheme === 'file'
    );

    console.log('workspaceFolders[0]?.uri.path----------------------');
    console.log(workspaceFolders[0]?.uri.path);
    console.log('----------------------');

    const rootPath = path.resolve(workspaceFolders[0]?.uri.path, '..', '..');
    const rootPath2 = path.resolve(
      __dirname,
      workspaceFolders[0]?.uri.path,
      '..',
      '..'
    );

    console.log('rootPath2----------------------');
    console.log(rootPath2);
    console.log('----------------------');

    const rootUri = vscode.Uri.parse(rootPath2);
    const treeController = testPlaygroundsExplorer.getTreeController();

    try {
      const children = await treeController.getPlaygrounds(rootUri);

      assert(
        Object.keys(children).length === 4,
        `Tree playgrounds should have 4 child, found ${children.length}`
      );

      const playgrounds = Object.values(children).filter(
        (item: any) => item.label && item.label.split('.').pop() === 'mongodb'
      );

      assert(
        Object.keys(playgrounds).length === 4,
        `Tree playgrounds should have 4 playgrounds with mongodb extension, found ${children.length}`
      );
    } catch (error) {
      assert(false, error);
    }
  });
});
