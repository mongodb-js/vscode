import * as vscode from 'vscode';

export default interface TreeItemParentInterface extends vscode.TreeItem {
  isExpanded: boolean;
  cacheIsUpToDate: boolean;

  onDidCollapse(): void;
  onDidExpand(): Promise<boolean>;
}
