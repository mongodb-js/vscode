import { expect } from 'chai';
import * as vscode from 'vscode';
import { before, afterEach } from 'mocha';
import path from 'path';
import { mdbTestExtension } from '../stubbableMdbExtension';
import PlaygroundsTree from './../../../explorer/playgroundsTree';
import formatError from '../../../utils/formatError';

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

  test('should show a welcome view if playgrounds list is empty', async function () {
    const treeController = testPlaygroundsExplorer.getTreeController();

    expect(treeController).to.exist;

    try {
      const treeControllerChildren = await treeController.getChildren();

      expect(treeControllerChildren.length).to.equal(
        0,
        `Tree controller should have 0 child, found ${treeControllerChildren.length}`,
      );
    } catch (error) {
      expect.fail(formatError(error).message);
    }
  });

  test('should search for playground in the workspace', async function () {
    const treeController = testPlaygroundsExplorer.getTreeController();

    const rootPath = path.resolve(__dirname, '../../../..');
    const children = await treeController.getPlaygrounds(rootPath);

    // The number of playground files in the project repository.
    expect(Object.keys(children).length).to.equal(8);
  });

  test('should exclude folders and files specified in extension settings', async function () {
    const treeController = new PlaygroundsTree();

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
    expect(Object.keys(children).length).to.equal(4);
  });
});
