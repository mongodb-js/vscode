import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import PlaygroundsTreeHeader from '../../../explorer/playgroundsTreeHeader';

suite('Playgrounds Tree Header Test Suite', () => {
  const workspaceFolders = (vscode.workspace.workspaceFolders || []).filter(
    (folder) => folder.uri.scheme === 'file'
  );
  const rootPath = path.resolve(workspaceFolders[0]?.uri.path, '..', '..');
  const rootUri = vscode.Uri.parse(rootPath);
  const testPlaygroundsTreeHeader = new PlaygroundsTreeHeader(rootUri, {});

  test('should search for playground in the workspace', async () => {
    try {
      const children = await testPlaygroundsTreeHeader.getChildren();

      assert(
        children.length === 4,
        `Tree playgrounds should have 4 child, found ${children.length}`
      );

      const playgrounds = children.filter(
        (item) => item.label && item.label.split('.').pop() === 'mongodb'
      );

      assert(
        children.length === 4,
        `Tree playgrounds should have 4 playgrounds with mongodb extension, found ${children.length}`
      );
    } catch (error) {
      assert(false, error);
    }
  });
});
