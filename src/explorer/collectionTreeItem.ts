import * as vscode from 'vscode';

import DocumentTreeItem from './documentTreeItem';
import TreeItemParent from './treeItemParentInterface';

// We fetch 1 more than this in order to see if there are more to fetch.
// Each time `show more` is clicked, the collection item increases the amount
// of documents shown by this amount.
const defaultMaxDocumentsToShow = 10;

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

export default class CollectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<CollectionTreeItem> {
  private _childrenCache: vscode.TreeItem[] = [];
  private _childrenCacheIsUpToDate = false;
  // We fetch 1 more than this in order to see if there are more to fetch.
  private _maxDocumentsToShow = defaultMaxDocumentsToShow;

  private _collectionName: string;
  private _databaseName: string;
  private _dataService: any;

  isExpanded = false;

  constructor(collectionName: string, databaseName: string, dataService: any) {
    super(collectionName, vscode.TreeItemCollapsibleState.Collapsed);

    this._collectionName = collectionName;
    this._databaseName = databaseName;
    this._dataService = dataService;
  }

  get tooltip(): string {
    return this._collectionName;
  }

  getTreeItem(element: CollectionTreeItem): CollectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (this.isExpanded) {
      if (this._childrenCacheIsUpToDate) {
        return Promise.resolve(this._childrenCache);
      }

      return new Promise((resolve, reject) => {
        const namespace = `${this._databaseName}.${this._collectionName}`;

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
          (err: any, documents: any[]) => {
            if (err) {
              return reject(`Unable to list documents: ${err}`);
            }

            this._childrenCacheIsUpToDate = true;

            if (documents) {
              this._childrenCache = documents.map((document, index) => {
                if (index === this._maxDocumentsToShow) {
                  return new ShowMoreDocumentsTreeItem(
                    namespace,
                    this.onShowMoreClicked,
                    this._maxDocumentsToShow
                  );
                }

                return new DocumentTreeItem(document);
              });
            } else {
              this._childrenCache = [];
            }

            return resolve(this._childrenCache);
          }
        );
      });
    }

    return Promise.resolve([]);
  }

  onShowMoreClicked = (): void => {
    this._maxDocumentsToShow += defaultMaxDocumentsToShow;
    this._childrenCacheIsUpToDate = false;
  };

  onDidCollapse = (): void => {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
    this._maxDocumentsToShow = defaultMaxDocumentsToShow;
  };

  onDidExpand = (): void => {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;
  };

  // Exposed for testing.
  public getMaxDocumentsToShow(): number {
    return this._maxDocumentsToShow;
  }
}
