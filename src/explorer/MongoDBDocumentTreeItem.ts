import * as vscode from 'vscode';

export default class MongoDBDocumentTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBDocumentTreeItem> {
  constructor(
    documentId: string
    // public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    // public readonly command?: vscode.Command
  ) {
    super(documentId, vscode.TreeItemCollapsibleState.None); // collapsibleState

    // this._collectionName = collectionName
  }

  get tooltip(): string {
    return 'tooltip';
  }

  get description(): string {
    return 'description';
  }

  getTreeItem(element: MongoDBDocumentTreeItem): MongoDBDocumentTreeItem {
    return element;
  }

  getChildren(): Thenable<MongoDBDocumentTreeItem[]> {
    return Promise.resolve([]);
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}
