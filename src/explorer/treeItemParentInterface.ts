import * as vscode from 'vscode';

export default interface TreeItemParentInterface extends vscode.TreeItem {
  isExpanded: boolean;

  onDidCollapse(): void;
  onDidExpand(): void;
}
