import * as vscode from 'vscode';

import CollectionTreeItem, { MAX_DOCUMENTS_VISIBLE } from './collectionTreeItem';
import TreeItemParent from './treeItemParentInterface';

export default class DatabaseTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DatabaseTreeItem> {
  private _childrenCache: { [collectionName: string]: CollectionTreeItem };
  private _childrenCacheIsUpToDate = false;

  private _databaseName: string;
  private _dataService: any;

  isExpanded: boolean;

  constructor(
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    existingChildrenCache: { [key: string]: CollectionTreeItem }
  ) {
    super(
      databaseName,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this._databaseName = databaseName;
    this._dataService = dataService;

    this.isExpanded = isExpanded;
    this._childrenCache = existingChildrenCache;
  }

  get tooltip(): string {
    return this._databaseName;
  }

  getTreeItem(element: DatabaseTreeItem): DatabaseTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.isExpanded) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(Object.values(this._childrenCache));
    }

    return new Promise((resolve, reject) => {
      this._dataService.listCollections(
        this._databaseName,
        {}, // No filter.
        (err: any, collections: string[]) => {
          if (err) {
            return reject(new Error(`Unable to list collections: ${err}`));
          }

          this._childrenCacheIsUpToDate = true;

          if (collections) {
            const pastChildrenCache = this._childrenCache;
            this._childrenCache = {};
            // Create new collection tree items, using previously cached items
            // where possible.
            collections.forEach((collection: any) => {
              if (pastChildrenCache[collection.name]) {
                this._childrenCache[collection.name] = new CollectionTreeItem(
                  collection,
                  this._databaseName,
                  this._dataService,
                  pastChildrenCache[collection.name].isExpanded,
                  pastChildrenCache[collection.name].getChildrenCache(),
                  pastChildrenCache[collection.name].getMaxDocumentsToShow()
                );
              } else {
                this._childrenCache[collection.name] = new CollectionTreeItem(
                  collection,
                  this._databaseName,
                  this._dataService,
                  false, // Not expanded.
                  [], // No cached documents.
                  MAX_DOCUMENTS_VISIBLE
                );
              }
            });
          } else {
            this._childrenCache = {};
          }

          return resolve(Object.values(this._childrenCache));
        });
    });
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;
    return Promise.resolve(true);
  }

  public getChildrenCache(): { [key: string]: CollectionTreeItem } {
    return this._childrenCache;
  }
}
