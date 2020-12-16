import { EJSON, Document } from 'bson';
import * as vscode from 'vscode';

export const DOCUMENT_ITEM = 'documentTreeItem';

export default class DocumentTreeItem extends vscode.TreeItem
  implements vscode.TreeDataProvider<DocumentTreeItem> {
  contextValue = DOCUMENT_ITEM;

  namespace: string;
  document: Document;
  documentId: EJSON.SerializableTypes;

  constructor(document: Document, namespace: string, documentIndexInTree: number) {
    // A document can not have a `_id` when it is in a view. In this instance
    // we just show the document's index in the tree.
    super(
      document._id
        ? JSON.stringify(document._id)
        : `Document ${documentIndexInTree + 1}`,
      vscode.TreeItemCollapsibleState.None
    );

    const documentLabel = document._id
      ? JSON.stringify(document._id)
      : `Document ${documentIndexInTree + 1}`;

    this.document = document;
    this.documentId = document._id;
    this.namespace = namespace;

    this.tooltip = documentLabel;
  }

  getTreeItem(element: DocumentTreeItem): DocumentTreeItem {
    return element;
  }

  getChildren(): Thenable<DocumentTreeItem[]> {
    return Promise.resolve([]);
  }
}
