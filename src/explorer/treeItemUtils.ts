import type * as vscode from 'vscode';

function getLabelString(
  label: string | vscode.TreeItemLabel | undefined,
): string {
  if (!label) {
    return '';
  }

  return typeof label === 'string' ? label : label.label;
}

export function sortTreeItemsByLabel(
  treeItems: vscode.TreeItem[],
): vscode.TreeItem[] {
  return treeItems.sort((a: vscode.TreeItem, b: vscode.TreeItem) =>
    getLabelString(a.label).localeCompare(getLabelString(b.label)),
  );
}
