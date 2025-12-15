import type * as vscode from 'vscode';

export function sortTreeItemsByLabel(
  treeItems: vscode.TreeItem[],
): vscode.TreeItem[] {
  return treeItems.sort((a: vscode.TreeItem, b: vscode.TreeItem) =>
    (a.label?.toString() || '').localeCompare(b.label?.toString() || ''),
  );
}
