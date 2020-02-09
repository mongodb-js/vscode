import * as vscode from 'vscode';

export default class MongoDBDocumentTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBDocumentTreeItem> {
  private _documentId: string;
  private _documentLabel: string;

  constructor(
    document: any
  ) {
    super(JSON.stringify(document._id), vscode.TreeItemCollapsibleState.None);
    // const documentLabel = JSON.stringify(document._id);

    this._documentId = document._id;
    this._documentLabel = JSON.stringify(document._id);
  }

  get tooltip(): string {
    return this._documentLabel;
  }

  get description(): string {
    return '';
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
