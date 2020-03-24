import * as vscode from 'vscode';
const path = require('path');

import { createLogger } from '../logging';
import DocumentTreeItem from './documentTreeItem';
import TreeItemParent from './treeItemParentInterface';

const log = createLogger('tree view document list');

// We fetch 1 more than this in order to see if there are more to fetch.
// Each time `show more` is clicked, the collection item increases the amount
// of documents shown by this amount.
export const MAX_DOCUMENTS_VISIBLE = 10;

export const DOCUMENT_LIST_ITEM = 'documentListTreeItem';
export enum CollectionTypes {
  collection = 'collection',
  view = 'view'
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
    this.id = `show-more-${namespace}-${documentsShown}`;
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

export default class DocumentListTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DocumentListTreeItem> {
  _childrenCacheIsUpToDate = false;
  private _childrenCache: vscode.TreeItem[] = [];

  contextValue = DOCUMENT_LIST_ITEM;

  // We fetch 1 more than this in order to see if there are more to fetch.
  private _maxDocumentsToShow: number;

  collectionName: string;
  databaseName: string;
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
    existingCache: vscode.TreeItem[] | null
  ) {
    super(ITEM_LABEL, getCollapsableStateForDocumentList(isExpanded, type));

    this.collectionName = collectionName;
    this.databaseName = databaseName;

    this.type = type; // Type can be `collection` or `view`.
    this._dataService = dataService;

    this.isExpanded = isExpanded;

    this._maxDocumentsToShow = maxDocumentsToShow;

    if (existingCache !== null) {
      this._childrenCache = existingCache;
      this._childrenCacheIsUpToDate = true;
    }
  }

  get tooltip(): string {
    const typeString = CollectionTypes.view ? 'View' : 'Collection';
    return `${typeString} Documents`;
  }

  getTreeItem(element: DocumentListTreeItem): DocumentListTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.isExpanded || this.type === CollectionTypes.view) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(this._childrenCache);
    }

    return new Promise((resolve, reject) => {
      const namespace = `${this.databaseName}.${this.collectionName}`;

      log.info(
        `fetching ${this._maxDocumentsToShow} documents from namespace ${namespace}`
      );

      this._dataService.find(
        namespace,
        {
          /* No filter */
        },
        {
          // We fetch 1 more than the max documents to show to see if
          // there are more documents we aren't showing.
          limit: 1 + this._maxDocumentsToShow
        },
        (err: Error, documents: []) => {
          if (err) {
            vscode.window.showErrorMessage(`Unable to list documents: ${err}`);
            return reject();
          }

          this._childrenCacheIsUpToDate = true;

          if (documents) {
            this._childrenCache = documents.map((document, index) => {
              if (index === this._maxDocumentsToShow) {
                return new ShowMoreDocumentsTreeItem(
                  namespace,
                  () => this.onShowMoreClicked(),
                  this._maxDocumentsToShow
                );
              }

              return new DocumentTreeItem(document, namespace, index);
            });
          } else {
            this._childrenCache = [];
          }

          return resolve(this._childrenCache);
        }
      );
    });
  }

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(__dirname, '..', '..', 'images', 'light');
    const DARK = path.join(__dirname, '..', '..', 'images', 'dark');

    return {
      light: path.join(LIGHT, 'documents.svg'),
      dark: path.join(DARK, 'documents.svg')
    };
  }

  onShowMoreClicked(): void {
    log.info('show more clicked');

    this._maxDocumentsToShow += MAX_DOCUMENTS_VISIBLE;
    this._childrenCacheIsUpToDate = false;
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
    this._maxDocumentsToShow = MAX_DOCUMENTS_VISIBLE;
  }

  onDidExpand(): Promise<boolean> {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;

    return Promise.resolve(true);
  }

  resetCache(): void {
    this._childrenCache = [];
    this._childrenCacheIsUpToDate = false;
  }

  getChildrenCache(): vscode.TreeItem[] | null {
    if (this._childrenCacheIsUpToDate) {
      return this._childrenCache;
    }

    return null;
  }

  getMaxDocumentsToShow(): number {
    return this._maxDocumentsToShow;
  }
}
