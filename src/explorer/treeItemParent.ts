import * as vscode from 'vscode';

export default interface TreeItemParent extends vscode.TreeItem {
  isExpanded: boolean;

  onDidCollapse(): void;
  onDidExpand(): void;
}
