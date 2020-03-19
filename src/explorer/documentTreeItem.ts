import * as vscode from 'vscode';
import { EJSON } from 'bson';

export const DOCUMENT_ITEM = 'documentTreeItem';
  namespace(namespace: <any>, documentId:<any>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  documentId(namespace: any, documentId: any): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

export default class DocumentTreeItem extends vscode.TreeItem
  implements vscode.TreeDataProvider<DocumentTreeItem> {
  contextValue = DOCUMENT_ITEM;

  private _documentLabel: string;

  namespace: string;
  documentId: string;

  constructor(document: any, namespace: string, documentIndexInTree: number) {
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

    this.documentId = document._id;
    this.namespace = namespace;
  }

  get tooltip(): string {
    return this._documentLabel;
  }

  getTreeItem(element: DocumentTreeItem): DocumentTreeItem {
    return element;
  }

  getChildren(): Thenable<DocumentTreeItem[]> {
    return Promise.resolve([]);
  }
}
