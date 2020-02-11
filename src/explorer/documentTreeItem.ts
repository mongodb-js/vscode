import * as vscode from 'vscode';

export default class MongoDBDocumentTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBDocumentTreeItem> {
  private _documentLabel: string;

  constructor(
    document: any
  ) {
    super(JSON.stringify(document._id), vscode.TreeItemCollapsibleState.None);

    this._documentLabel = JSON.stringify(document._id);
  }

  get tooltip(): string {
    return this._documentLabel;
  }

  getTreeItem(element: MongoDBDocumentTreeItem): MongoDBDocumentTreeItem {
    return element;
  }

  getChildren(): Thenable<MongoDBDocumentTreeItem[]> {
    return Promise.resolve([]);
  }
}
