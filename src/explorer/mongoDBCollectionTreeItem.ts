import * as vscode from 'vscode';

export default class MongoDBCollectionTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBCollectionTreeItem> {
  constructor(
    collectionName: string
    // public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    // public readonly command?: vscode.Command
  ) {
    super(collectionName, vscode.TreeItemCollapsibleState.None); // collapsibleState

    // this._collectionName = collectionName
  }

  get tooltip(): string {
    return 'tooltip';
  }

  get description(): string {
    return 'description';
  }

  getTreeItem(element: MongoDBCollectionTreeItem): MongoDBCollectionTreeItem {
    return element;
  }

  getChildren(): Thenable<MongoDBCollectionTreeItem[]> {
    console.log('Get connection tree item children');

    return Promise.resolve([]);
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}
