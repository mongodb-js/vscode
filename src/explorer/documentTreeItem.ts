import { EJSON } from 'bson';
import * as vscode from 'vscode';
import type { Document } from 'mongodb';
import type { DataService } from 'mongodb-data-service';
import { promisify } from 'util';
import { toJSString } from 'mongodb-query-parser';

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
  resetDocumentListCache: () => Promise<void>;

  constructor(
    document: Document,
    namespace: string,
    documentIndexInTree: number,
    dataService: DataService,
    resetDocumentListCache: () => Promise<void>
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
    this.resetDocumentListCache = resetDocumentListCache;

    this.tooltip = documentLabel;
  }

  getTreeItem(element: DocumentTreeItem): DocumentTreeItem {
    return element;
  }

  getChildren(): Thenable<DocumentTreeItem[]> {
    return Promise.resolve([]);
  }

  async getDocumentContents(): Promise<Document> {
    const documents = await this.dataService.find(
      this.namespace,
      { _id: this.documentId },
      { limit: 1 }
    );

    if (!documents || documents.length === 0) {
      throw new Error('document not found');
    }

    return documents[0];
  }

  async getStringifiedEJSONDocumentContents(): Promise<string> {
    const document = await this.getDocumentContents();

    return EJSON.stringify(document, undefined, 2);
  }

  async getJSStringDocumentContents(): Promise<string> {
    const ejsonDocument = await this.getDocumentContents();

    return toJSString(ejsonDocument, 2);
  }

  async onDeleteDocumentClicked(): Promise<boolean> {
    const shouldConfirmDeleteDocument = vscode.workspace
      .getConfiguration('mdb')
      .get('confirmDeleteDocument');

    if (shouldConfirmDeleteDocument === true) {
      const confirmationResult = await vscode.window.showInformationMessage(
        `Are you sure you wish to drop this document "${this.tooltip}"?  This confirmation can be disabled in the extension settings.`,
        {
          modal: true,
        },
        'Yes'
      );

      if (confirmationResult !== 'Yes') {
        return false;
      }
    }

    try {
      const deleteOne = promisify(
        this.dataService.deleteOne.bind(this.dataService)
      );
      const deleteResult = await deleteOne(
        this.namespace,
        { _id: this.documentId },
        {}
      );

      if (deleteResult.deletedCount !== 1) {
        throw new Error('document not found');
      }

      await this.resetDocumentListCache();

      return true;
    } catch (error) {
      throw new Error(formatError(error).message);
    }
  }
}
