import * as vscode from 'vscode';
const path = require('path');

import { createLogger } from '../logging';
import IndexTreeItem from './indexTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { getImagesPath } from '../extensionConstants';
import { sortTreeItemsByLabel } from './treeItemUtils';

const log = createLogger('tree view indexes list');

const ITEM_LABEL = 'Indexes';

export default class IndexListTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<IndexListTreeItem> {
  _childrenCacheIsUpToDate = false;
  private _childrenCache: vscode.TreeItem[] = [];

  contextValue = 'indexListTreeItem';

  collectionName: string;
  databaseName: string;

  private _dataService: any;

  isExpanded: boolean;

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    existingCache: vscode.TreeItem[] | null
  ) {
    super(
      ITEM_LABEL,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.collectionName = collectionName;
    this.databaseName = databaseName;

    this._dataService = dataService;

    this.isExpanded = isExpanded;

    if (existingCache !== null) {
      this._childrenCache = existingCache;
      this._childrenCacheIsUpToDate = true;

      // Show the count of indexes next to the item label.
      this.description = `${existingCache.length}`;
    }
  }

  get tooltip(): string {
    return 'Collection Indexes';
  }

  getTreeItem(element: IndexListTreeItem): IndexListTreeItem {
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

      log.info(
        `fetching indexes from namespace ${namespace}`
      );

      this._dataService.indexes(
        namespace,
        {
          /* No options */
        },
        (err: Error, indexes: []) => {
          if (err) {
            vscode.window.showErrorMessage(`Unable to fetch indexes: ${err}`);
            return reject();
          }

          this._childrenCacheIsUpToDate = true;

          if (indexes) {
            // Show the count of indexes next to the item label.
            this.description = `${indexes.length}`;

            this._childrenCache = sortTreeItemsByLabel(
              indexes.map(index => {
                return new IndexTreeItem(index, namespace);
              })
            );
          } else {
            this._childrenCache = [];
          }

          return resolve(this._childrenCache);
        }
      );
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
}
