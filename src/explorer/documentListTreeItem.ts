import * as vscode from 'vscode';
import * as numeral from 'numeral';
const path = require('path');

import { createLogger } from '../logging';
import DocumentTreeItem from './documentTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { getImagesPath } from '../extensionConstants';

const log = createLogger('tree view document list');

// We fetch 1 more than this in order to see if there are more to fetch.
// Each time `show more` is clicked, the collection item increases the amount
// of documents shown by this amount.
export const MAX_DOCUMENTS_VISIBLE = 10;

export const DOCUMENT_LIST_ITEM = 'documentListTreeItem';
export enum CollectionTypes {
  collection = 'collection',
  view = 'view',
}

const ITEM_LABEL = 'Documents';

class ShowMoreDocumentsTreeItem extends vscode.TreeItem {
  // This is the identifier we use to identify this tree item when a tree item
  // has been clicked. Activated from the explorer controller `onDidChangeSelection`.
  isShowMoreItem = true;
  onShowMoreClicked: () => void;

  constructor(namespace: string, showMore: () => void, documentsShown: number) {
    super('Show more...', vscode.TreeItemCollapsibleState.None);

    // We assign the item a unique id so that when it is selected the selection
    // resets (de-selects) when the documents are fetched and a new item is shown.
    this.id = `show-more-${namespace}-${documentsShown}-${Math.random()}`;
    this.onShowMoreClicked = showMore;
  }
}

const getCollapsableStateForDocumentList = (
  isExpanded: boolean,
  type: CollectionTypes
): vscode.TreeItemCollapsibleState => {
  if (type === CollectionTypes.view) {
    return vscode.TreeItemCollapsibleState.None;
  }

  return isExpanded
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.Collapsed;
};

export const formatDocCount = (count: number): string => {
  // We format the count (30000 -> 30k) and then display it uppercase (30K).
  return `${numeral(count).format('0a')}`.toUpperCase();
};

export default class DocumentListTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DocumentListTreeItem> {
  cacheIsUpToDate = false;
  private _childrenCache: Array<
    DocumentTreeItem | ShowMoreDocumentsTreeItem
  > = [];

  contextValue = DOCUMENT_LIST_ITEM;

  // We display the document count in the description of the
  // document list tree item, even when it hasn't been expanded.
  // When it is expanded, we want to ensure that number is up to date.
  // This function tells the parent collection folder to refresh the count.
  refreshDocumentCount: () => Promise<boolean>;

  _documentCount: number | null;
  private _maxDocumentsToShow: number;

  collectionName: string;
  databaseName: string;
  namespace: string;
  type: CollectionTypes;

  private _dataService: any;

  isExpanded: boolean;

  constructor(
    collectionName: string,
    databaseName: string,
    type: CollectionTypes,
    dataService: any,
    isExpanded: boolean,
    maxDocumentsToShow: number,
    cachedDocumentCount: number | null,
    refreshDocumentCount: () => Promise<boolean>,
    cacheIsUpToDate: boolean,
    existingCache: Array<DocumentTreeItem | ShowMoreDocumentsTreeItem>
  ) {
    super(ITEM_LABEL, getCollapsableStateForDocumentList(isExpanded, type));

    this.collectionName = collectionName;
    this.databaseName = databaseName;
    this.namespace = `${this.databaseName}.${this.collectionName}`;

    this.type = type; // Type can be `collection` or `view`.
    this._dataService = dataService;

    this.isExpanded = isExpanded;

    this._maxDocumentsToShow = maxDocumentsToShow;
    this._documentCount = cachedDocumentCount;

    this.refreshDocumentCount = refreshDocumentCount;

    this._childrenCache = existingCache;
    this.cacheIsUpToDate = cacheIsUpToDate;

    if (this._documentCount !== null) {
      this.description = formatDocCount(this._documentCount);
    }
  }

  get tooltip(): string {
    const typeString =
      this.type === CollectionTypes.view ? 'View' : 'Collection';
    if (this._documentCount !== null) {
      return `${typeString} Documents - ${this._documentCount}`;
    }
    return `${typeString} Documents`;
  }

[MongoDB Documentation](https://docs.mongodb.com/manual/)
[Extension Documentation](https://docs.mongodb.com/mongodb-vscode/)
[Feedback](https://feedback.mongodb.com/forums/929236-mongodb-for-vs-code/)
[Submit a bug](https://github.com/mongodb-js/vscode/issues)

  getTreeItem(element: DocumentListTreeItem): DocumentListTreeItem {
    return element;
  }

  async getDocuments(): Promise<[]> {
    log.info(
      `fetching ${this._maxDocumentsToShow} documents from namespace ${this.namespace}`
    );

    return new Promise((resolve, reject) => {
      this._dataService.find(
        this.namespace,
        {
          /* No filter */
        },
        {
          limit: this._maxDocumentsToShow
        },
        (err: Error, documents: []) => {
          if (err) {
            vscode.window.showErrorMessage(`Unable to list documents: ${err}`);
            return reject(err);
          }

          resolve(documents);
        }
      );
    });
  }

  hasMoreDocumentsToShow(): boolean {
    if (this._documentCount === null) {
      return false;
    }

    return this._maxDocumentsToShow <= this._documentCount;
  }

  async getChildren(): Promise<any[]> {
    if (!this.isExpanded || this.type === CollectionTypes.view) {
      return [];
    }

    if (this.cacheIsUpToDate) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = [];

      pastChildrenCache.forEach((pastTreeItem, index) => {
        this._childrenCache.push(
          new DocumentTreeItem(
            (pastTreeItem as DocumentTreeItem).document,
            this.namespace,
            index
          )
        );
      });

      if (this.hasMoreDocumentsToShow()) {
        return [
          ...this._childrenCache,
          // Add a `Show more...` item when there are more documents to show.
          new ShowMoreDocumentsTreeItem(
            this.namespace,
            () => this.onShowMoreClicked(),
            this._maxDocumentsToShow
          )
        ];
      }

      return this._childrenCache;
    }

    let documents;
    try {
      documents = await this.getDocuments();
    } catch (err) {
      return Promise.reject(err);
    }

    this.cacheIsUpToDate = true;
    this._childrenCache = [];

    if (documents) {
      documents.forEach((document, index) => {
        this._childrenCache.push(
          new DocumentTreeItem(document, this.namespace, index)
        );
      });
    }

    if (this.hasMoreDocumentsToShow()) {
      return [
        ...this._childrenCache,
        new ShowMoreDocumentsTreeItem(
          this.namespace,
          () => this.onShowMoreClicked(),
          this._maxDocumentsToShow
        )
      ];
    }

    return this._childrenCache;
  }

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(getImagesPath(), 'light');
    const DARK = path.join(getImagesPath(), 'dark');

    return {
      light: path.join(LIGHT, 'documents.svg'),
      dark: path.join(DARK, 'documents.svg')
    };
  }

  onShowMoreClicked(): void {
    log.info('show more clicked');

    this._maxDocumentsToShow += MAX_DOCUMENTS_VISIBLE;
    this.cacheIsUpToDate = false;
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this.cacheIsUpToDate = false;
    this._maxDocumentsToShow = MAX_DOCUMENTS_VISIBLE;
  }

  async onDidExpand(): Promise<boolean> {
    this.cacheIsUpToDate = false;
    this.isExpanded = true;

    await this.refreshDocumentCount();

    return true;
  }

  async resetCache(): Promise<void> {
    this.isExpanded = false;
    this._childrenCache = [];
    this.cacheIsUpToDate = false;

    await this.refreshDocumentCount();
  }

  getChildrenCache(): Array<DocumentTreeItem | ShowMoreDocumentsTreeItem> {
    return this._childrenCache;
  }

  getMaxDocumentsToShow(): number {
    return this._maxDocumentsToShow;
  }
}
