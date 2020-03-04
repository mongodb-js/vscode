import * as vscode from 'vscode';
const path = require('path');

import DocumentTreeItem from './documentTreeItem';
import TreeItemParent from './treeItemParentInterface';

// We fetch 1 more than this in order to see if there are more to fetch.
// Each time `show more` is clicked, the collection item increases the amount
// of documents shown by this amount.
export const MAX_DOCUMENTS_VISIBLE = 10;

class ShowMoreDocumentsTreeItem extends vscode.TreeItem {
  // This is the identifier we use to identify this tree item when a tree item
  // has been clicked. Activated from the explorer controller `onDidChangeSelection`.
  public isShowMoreItem = true;
  public onShowMoreClicked: () => void;

  constructor(namespace: string, showMore: () => void, documentsShown: number) {
    super('Show more...', vscode.TreeItemCollapsibleState.None);

    // We assign the item a unique id so that when it is selected the selection
    // resets (de-selects) when the documents are fetched and a new item is shown.
    this.id = `show-more-${namespace}-${documentsShown}`;
    this.onShowMoreClicked = showMore;
  }
}

export enum CollectionTypes {
  collection = 'collection',
  view = 'view'
}

export default class CollectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<CollectionTreeItem> {
  _childrenCacheIsUpToDate = false;
  private _childrenCache: vscode.TreeItem[] = [];

  contextValue = 'collectionTreeItem';

  // We fetch 1 more than this in order to see if there are more to fetch.
  private _maxDocumentsToShow: number;

  collectionName: string;
  databaseName: string;

  private _dataService: any;
  private _type: CollectionTypes;

  isExpanded: boolean;

  constructor(
    collection: any,
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    existingChildrenCache: vscode.TreeItem[],
    maxDocumentsToShow: number
  ) {
    super(collection.name, isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);

    this.collectionName = collection.name;
    this.databaseName = databaseName;

    this._type = collection.type; // Type can be `collection` or `view`.
    this._dataService = dataService;

    this.isExpanded = isExpanded;
    this._childrenCache = existingChildrenCache;
    this._maxDocumentsToShow = maxDocumentsToShow;
  }

  get tooltip(): string {
    return this._type === CollectionTypes.view
      ? 'Read only view'
      : this.collectionName;
  }

  getTreeItem(element: CollectionTreeItem): CollectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.isExpanded) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(this._childrenCache);
    }

    return new Promise((resolve, reject) => {
      const namespace = `${this.databaseName}.${this.collectionName}`;

      this._dataService.find(
        namespace,
        { /* No filter */ },
        {
          // We fetch 1 more than the max documents to show to see if
          // there are more documents we aren't showing.
          limit: 1 + this._maxDocumentsToShow
        },
        (err: Error, documents: []) => {
          if (err) {
            return reject(new Error(`Unable to list documents: ${err}`));
          }

          this._childrenCacheIsUpToDate = true;

          if (documents) {
            this._childrenCache = documents.map(
              (document, index) => {
                if (index === this._maxDocumentsToShow) {
                  return new ShowMoreDocumentsTreeItem(
                    namespace,
                    () => this.onShowMoreClicked(),
                    this._maxDocumentsToShow
                  );
                }

                return new DocumentTreeItem(document, index);
              }
            );
          } else {
            this._childrenCache = [];
          }

          return resolve(this._childrenCache);
        }
      );
    });
  }

  get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    return this._type === CollectionTypes.collection
      ? {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'collection.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'collection.svg')
      }
      : {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'view.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'view.svg')
      };
  }

  onShowMoreClicked(): void {
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

  getChildrenCache(): vscode.TreeItem[] {
    return this._childrenCache;
  }

  getMaxDocumentsToShow(): number {
    return this._maxDocumentsToShow;
  }

  async onDropCollectionClicked(): Promise<boolean> {
    const collectionName = this.collectionName;

    let inputtedCollectionName;
    try {
      inputtedCollectionName = await vscode.window.showInputBox({
        value: '',
        placeHolder:
          'e.g. myNewCollection',
        prompt: `Are you sure you wish to drop this collection? Enter the collection name '${collectionName}' to confirm.`,
        validateInput: (inputCollectionName: any) => {
          if (inputCollectionName && !collectionName.startsWith(inputCollectionName)) {
            return 'Collection name does not match';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.reject(`An error occured parsing the collection name: ${e}`);
    }

    if (!inputtedCollectionName || collectionName !== inputtedCollectionName) {
      return Promise.resolve(false);
    }

    return new Promise((resolve, reject) => {
      this._dataService.dropCollection(`${this.databaseName}.${collectionName}`,
        (err) => {
          if (err) {
            return reject(new Error(`Drop collection failed: ${err.message}`));
          }

          this._childrenCacheIsUpToDate = false;
          return resolve(true);
        }
      );
    });
  }
}
