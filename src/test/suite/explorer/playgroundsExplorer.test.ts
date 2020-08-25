import * as assert from 'assert';
import * as vscode from 'vscode';
import { mdbTestExtension } from '../stubbableMdbExtension';

suite('Playgrounds Controller Test Suite', () => {
  test('should have a workspace root without children', async () => {
    const testPlaygroundsExplorer =
      mdbTestExtension.testExtensionController._playgroundsExplorer;
    const treeController = testPlaygroundsExplorer.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');

    try {
      const treeControllerChildren = await treeController.getChildren();
      const workspaceFolders = (vscode.workspace.workspaceFolders || []).filter(
        (folder) => folder.uri.scheme === 'file'
      );
      const rootPath = workspaceFolders[0]?.uri.path;

      assert(
        treeControllerChildren.length === 1,
        `Tree controller should have 1 child, found ${treeControllerChildren.length}`
      );
      assert(
        treeControllerChildren[0].label === rootPath,
        'Tree controller should have a root Uri child'
      );

      const playgrounds = await treeControllerChildren[0].getChildren();

      assert(
        playgrounds.length === 0,
        `Expected there to be 0 playgrounds tree item, found ${playgrounds.length}`
      );
    } catch (error) {
      assert(false, error);
    }
  });
});
