import * as vscode from 'vscode';

export default class MongoDBDatabaseTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBDatabaseTreeItem> {
  constructor(
    public readonly label: string
    // public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    // public readonly command?: vscode.Command
  ) {
    super(label); // collapsibleState
  }

  get tooltip(): string {
    return 'tooltip';
  }

  get description(): string {
    return 'description';
  }

  getTreeItem(element: MongoDBDatabaseTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<[]> {
    return Promise.resolve([]);
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}
