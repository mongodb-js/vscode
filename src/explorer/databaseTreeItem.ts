import * as vscode from 'vscode';

import CollectionTreeItem from './collectionTreeItem';
import TreeItemParent from './treeItemParentInterface';

export default class DatabaseTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DatabaseTreeItem> {
  private _childrenCache: CollectionTreeItem[] = [];
  private _childrenCacheIsUpToDate = false;

  private _databaseName: string;
  private _dataService: any;

  isExpanded: boolean;

  constructor(databaseName: string, dataService: any) {
    super(databaseName, vscode.TreeItemCollapsibleState.Collapsed);

    this._databaseName = databaseName;
    this._dataService = dataService;
    this.isExpanded = false;
  }

  get tooltip(): string {
    return this._databaseName;
  }

  getTreeItem(element: DatabaseTreeItem): DatabaseTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (this.isExpanded) {
      if (this._childrenCacheIsUpToDate) {
        return Promise.resolve(this._childrenCache);
      }

      return new Promise((resolve, reject) => {
        this._dataService.listCollections(
          this._databaseName,
          {},
          (err: any, collections: string[]) => {
            if (err) {
              return reject(`Unable to list collections: ${err}`);
            }

            this._childrenCacheIsUpToDate = true;

            if (collections) {
              this._childrenCache = collections.map(
                ({ name }: any) =>
                  new CollectionTreeItem(
                    name,
                    this._databaseName,
                    this._dataService
                  )
              );
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

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): void {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;
  }
}
