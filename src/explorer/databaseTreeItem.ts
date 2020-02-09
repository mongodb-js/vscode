import * as vscode from 'vscode';

import CollectionTreeItem from './collectionTreeItem';
import TreeItemParent from './treeItemParentInterface';

export default class DatabaseTreeItem extends vscode.TreeItem implements TreeItemParent, vscode.TreeDataProvider<DatabaseTreeItem> {
  private _childrenCache: CollectionTreeItem[] = [];
  private _childrenCacheIsUpToDate: boolean = false;

  private _databaseName: string;
  private _dataService: any;

  isExpanded: boolean;

  constructor(
    databaseName: string,
    dataService: any
  ) {
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

  // TODO: Get a slightly stricter type than any.
  getChildren(): Thenable<any[]> {
    if (this.isExpanded) {
      if (this._childrenCacheIsUpToDate) {
        return Promise.resolve(this._childrenCache);
      } else {
        // TODO: Version cache requests.
        return new Promise((resolve, reject) => {
          this._dataService.listCollections(this._databaseName, {}, (err: any, collections: string[]) => {
            this._childrenCacheIsUpToDate = true;

            if (err) {
              // TODO: Error here properly.
              this._childrenCache = [];
              return resolve(this._childrenCache);
            }

            if (collections) {
              this._childrenCache = collections.map(
                ({ name }: any) => new CollectionTreeItem(name, this._databaseName, this._dataService)
              );
            } else {
              this._childrenCache = [];
            }

            return resolve(this._childrenCache);
          });
        });
      }
    }

    return Promise.resolve([]);
  }

  onDidCollapse() {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand() {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}
