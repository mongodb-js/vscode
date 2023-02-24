import * as vscode from 'vscode';
import TreeItemParent from './treeItemParentInterface';
import NotebooksTreeItem from './notebooksTreeItem';
import { sortTreeItemsByLabel } from './treeItemUtils';

export default class NotebooksTreeHeader
  extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<vscode.TreeItem>
{
  private _notebooksTreeItems: { [key: string]: NotebooksTreeItem };

  contextValue = 'notebooksTreeHeader' as const;
  isExpanded = true;
  doesNotRequireTreeUpdate = true;
  cacheIsUpToDate = true;

  constructor(
    fileUri: vscode.Uri,
    notebooksTreeItems: {
      [key: string]: NotebooksTreeItem;
    }
  ) {
    super(fileUri.path, vscode.TreeItemCollapsibleState.Expanded);
    this._notebooksTreeItems = notebooksTreeItems;

    this.tooltip = 'Your MongoDB notebooks';
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(): Promise<vscode.TreeItem[]> {
    return Promise.resolve(
      sortTreeItemsByLabel(Object.values(this._notebooksTreeItems))
    );
  }

  public onDidCollapse(): void {
    this.isExpanded = false;
  }

  public onDidExpand(): Promise<boolean> {
    this.isExpanded = true;

    return Promise.resolve(true);
  }
}
