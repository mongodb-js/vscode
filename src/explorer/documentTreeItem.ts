import { EJSON } from 'bson';
import * as vscode from 'vscode';
import type { Document } from 'mongodb';
import type { DataService } from 'mongodb-data-service';
import { promisify } from 'util';
import formatError from '../utils/formatError';

export const DOCUMENT_ITEM = 'documentTreeItem';

export default class DocumentTreeItem
  extends vscode.TreeItem
  implements vscode.TreeDataProvider<DocumentTreeItem>
{
  contextValue = DOCUMENT_ITEM;

  namespace: string;
  dataService: DataService;
  document: Document;
  documentId: EJSON.SerializableTypes;

  constructor(
    document: Document,
    namespace: string,
    documentIndexInTree: number,
    dataService: DataService
  ) {
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

    this.dataService = dataService;
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

  async getStringifiedEJSONDocumentContents(): Promise<string> {
    try {
      const find = promisify(this.dataService.find.bind(this.dataService));
      const documents = await find(
        this.namespace,
        { _id: this.documentId },
        { limit: 1 }
      );

      if (!documents || documents.length === 0) {
        throw new Error('document not found');
      }

      return EJSON.stringify(documents[0], undefined, 2);
    } catch (error) {
      throw new Error(formatError(error).message);
    }
  }
}
