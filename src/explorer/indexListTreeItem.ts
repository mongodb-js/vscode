import * as vscode from 'vscode';
const path = require('path');

import { createLogger } from '../logging';
import IndexTreeItem from './indexTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { sortTreeItemsByLabel } from './treeItemUtils';
import { getImagesPath } from '../extensionConstants';

const log = createLogger('tree view indexes list');

const ITEM_LABEL = 'Indexes';

export default class IndexListTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<IndexListTreeItem> {
  cacheIsUpToDate = false;
  private _childrenCache: vscode.TreeItem[] = [];

  contextValue = 'indexListTreeItem';

  collectionName: string;
  databaseName: string;
  namespace: string;

  private _dataService: any;

  isExpanded: boolean;

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    cacheIsUpToDate: boolean,
    existingCache: vscode.TreeItem[]
  ) {
    super(
      ITEM_LABEL,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.collectionName = collectionName;
    this.databaseName = databaseName;
    this.namespace = `${databaseName}.${collectionName}`;

    this._dataService = dataService;

    this.isExpanded = isExpanded;

    this._childrenCache = existingCache;
    this.cacheIsUpToDate = cacheIsUpToDate;
  }

  get tooltip(): string {
    return 'Collection Indexes';
  }

  getTreeItem(element: IndexListTreeItem): IndexListTreeItem {
    return element;
  }

  getIndexes(): Promise<any> {
    const namespace = this.namespace;

    log.info(`fetching indexes from namespace ${namespace}`);

    return new Promise((resolve, reject) => {
      this._dataService.indexes(
        namespace,
        {
          /* No options */
        },
        (err: Error, indexes: any[]) => {
          if (err) {
            return reject(err);
          }

          return resolve(indexes);
        }
      );
    });
  }

  async getChildren(): Promise<any[]> {
    if (!this.isExpanded) {
      return Promise.resolve([]);
    }

    if (this.cacheIsUpToDate) {
      return Promise.resolve(this._childrenCache);
    }

    let indexes;
    try {
      indexes = await this.getIndexes();
    } catch (err) {
      Promise.reject(err);
    }

    this.cacheIsUpToDate = true;

    if (indexes) {
      const namespace = this.namespace;

      this._childrenCache = sortTreeItemsByLabel(
        indexes.map((index) => {
          return new IndexTreeItem(index, namespace);
        })
      );
    } else {
      this._childrenCache = [];
    }

    return Promise.resolve(this._childrenCache);
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this.cacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this.cacheIsUpToDate = false;
    this.isExpanded = true;

    return Promise.resolve(true);
  }

  getChildrenCache(): vscode.TreeItem[] {
    if (this.cacheIsUpToDate) {
      return this._childrenCache;
    }

    return [];
  }

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(getImagesPath(), 'light');
    const DARK = path.join(getImagesPath(), 'dark');

    return {
      light: path.join(LIGHT, 'indexes.svg'),
      dark: path.join(DARK, 'indexes.svg')
    };
  }
}
