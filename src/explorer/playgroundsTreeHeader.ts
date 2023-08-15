import * as vscode from 'vscode';
import type TreeItemParent from './treeItemParentInterface';
import type PlaygroundsTreeItem from './playgroundsTreeItem';
import { sortTreeItemsByLabel } from './treeItemUtils';

export default class PlaygroundsTreeHeader
  extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<vscode.TreeItem>
{
  private _playgroundsTreeItems: { [key: string]: PlaygroundsTreeItem };

  contextValue = 'playgroundsTreeHeader' as const;
  isExpanded = true;
  doesNotRequireTreeUpdate = true;
  cacheIsUpToDate = true;

  constructor({
    fileUri,
    playgroundsTreeItems,
  }: {
    fileUri: vscode.Uri;
    playgroundsTreeItems: {
      [key: string]: PlaygroundsTreeItem;
    };
  }) {
    super(fileUri.path, vscode.TreeItemCollapsibleState.Expanded);
    this._playgroundsTreeItems = playgroundsTreeItems;

    this.tooltip = 'Your MongoDB playgrounds';
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(): Promise<vscode.TreeItem[]> {
    return Promise.resolve(
      sortTreeItemsByLabel(Object.values(this._playgroundsTreeItems))
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
