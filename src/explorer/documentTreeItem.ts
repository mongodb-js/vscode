import * as vscode from 'vscode';

export default class MongoDBDocumentTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBDocumentTreeItem> {
  private _documentLabel: string;

  constructor(
    document: any,
    documentIndexInTree: number
  ) {
    // A document can not have a `_id` when it is in a view. In this instance
    // we just show the document's index in the tree.
    super(
      document._id
        ? JSON.stringify(document._id)
        : `Document ${documentIndexInTree + 1}`,
      vscode.TreeItemCollapsibleState.None
    );

    this._documentLabel = document._id
      ? JSON.stringify(document._id)
      : `Document ${documentIndexInTree + 1}`;
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
