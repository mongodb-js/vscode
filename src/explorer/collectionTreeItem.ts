import * as vscode from 'vscode';

import DocumentTreeItem from './documentTreeItem';
import TreeItemParent from './treeItemParentInterface';

// We fetch 1 more than this in order to see if there are more to fetch.
// Each time `show more` is clicked, the collection item increases the amount
// of documents shown by this amount.
const defaultMaxDocumentsToShow = 10;

export default class CollectionTreeItem extends vscode.TreeItem implements TreeItemParent, vscode.TreeDataProvider<CollectionTreeItem> {
  private _childrenCache: vscode.TreeItem[] = [];
  private _childrenCacheIsUpToDate: boolean = false;
  // We fetch 1 more than this in order to see if there are more to fetch.
  private _maxDocumentsToShow = defaultMaxDocumentsToShow;

  private _collectionName: string;
  private _databaseName: string;
  private _dataService: any;

  isExpanded: boolean = false;

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: any
  ) {
    super(collectionName, vscode.TreeItemCollapsibleState.Collapsed);

    this._collectionName = collectionName;
    this._databaseName = databaseName;
    this._dataService = dataService;
  }

  get tooltip(): string {
    return this._collectionName;
  }

  get description(): string {
    return '';
  }

  getTreeItem(element: CollectionTreeItem): CollectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (this.isExpanded) {
      if (this._childrenCacheIsUpToDate) {
        return Promise.resolve(this._childrenCache);
      } else {
        console.log('updating collection cache.');
        // TODO: Version cache requests.
        return new Promise(resolve => {
          this._dataService.find(
            `${this._databaseName}.${this._collectionName}`,
            { /* No filter */ },
            {
              // We fetch 1 more than the max documents to show to see if
              // there are more documents we aren't showing.
              limit: 1 + this._maxDocumentsToShow
            },
            (err: any, documents: any[]) => {
              this._childrenCacheIsUpToDate = true;

              if (err) {
                this._childrenCache = [];
                return resolve(this._childrenCache);
              }

              if (documents) {
                this._childrenCache = documents.map(
                  (document, index) => index === this._maxDocumentsToShow ?
                    new ShowMoreDocumentsTreeItem(this.onShowMoreClicked) : new DocumentTreeItem(document)
                );
              } else {
                this._childrenCache = [];
              }

              return resolve(this._childrenCache);
            }
          );
        });
      }
    }

    return Promise.resolve([]);
  }

  onShowMoreClicked = () => {
    console.log('Show more clicked.');
    this._maxDocumentsToShow += defaultMaxDocumentsToShow;
    this._childrenCacheIsUpToDate = false;
    console.log('max documents', this._maxDocumentsToShow);
  }

  onDidCollapse = () => {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
    this._maxDocumentsToShow = defaultMaxDocumentsToShow;
  }

  onDidExpand = () => {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}

class ShowMoreDocumentsTreeItem extends vscode.TreeItem {
  // This is the identifier we use to identify this tree item when a tree item
  // has been clicked. Activated from the explorer controller `onDidChangeSelection`.
  public isShowMoreItem: boolean = true;
  public onShowMoreClicked: () => void;

  constructor(showMore: () => void) {
    super(`Show more...`, vscode.TreeItemCollapsibleState.None);

    // We assign the item an id so that when it is selected the selection
    // resets (de-selects) when the documents are fetched and a new item is shown.
    this.id = `show-more-${Math.random()}`;
    this.onShowMoreClicked = showMore;
  }
}
