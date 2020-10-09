import * as vscode from 'vscode';
const path = require('path');

import { createLogger } from '../logging';
import IndexTreeItem, { IndexModel } from './indexTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { sortTreeItemsByLabel } from './treeItemUtils';
import { getImagesPath } from '../extensionConstants';

const log = createLogger('tree view indexes list');

const ITEM_LABEL = 'Indexes';

function getIconPath(): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'indexes.svg'),
    dark: path.join(DARK, 'indexes.svg')
  };
}

export default class IndexListTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<IndexListTreeItem> {
  cacheIsUpToDate = false;
  private _childrenCache: IndexTreeItem[] = [];

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
    existingCache: IndexTreeItem[]
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

    this.iconPath = getIconPath();
    this.tooltip = 'Collection Indexes';
  }

  getTreeItem(element: IndexListTreeItem): IndexListTreeItem {
    return element;
  }

  getIndexes(): Promise<IndexModel[]> {
    const namespace = this.namespace;

    log.info(`fetching indexes from namespace ${namespace}`);

    return new Promise((resolve, reject) => {
      this._dataService.indexes(
        namespace,
        {
          /* No options */
        },
        (err: Error, indexes: IndexModel[]) => {
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
      return [];
    }

    if (this.cacheIsUpToDate) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = [];

      // We manually rebuild each node to ensure we update the expanded state.
      pastChildrenCache.forEach((cachedItem: IndexTreeItem) => {
        this._childrenCache.push(
          new IndexTreeItem(
            cachedItem.index,
            cachedItem.namespace,
            cachedItem.isExpanded
          )
        );
      });

      return this._childrenCache;
    }

    const indexes = await this.getIndexes();

    this.cacheIsUpToDate = true;

    if (indexes) {
      const namespace = this.namespace;

      this._childrenCache = sortTreeItemsByLabel(
        indexes.map((index: IndexModel) => {
          return new IndexTreeItem(index, namespace, false /* Not expanded. */);
        })
      ) as IndexTreeItem[];
    } else {
      this._childrenCache = [];
    }

    return this._childrenCache;
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

  getChildrenCache(): IndexTreeItem[] {
    if (this.cacheIsUpToDate) {
      return this._childrenCache;
    }

    return [];
  }

  resetCache(): void {
    this.cacheIsUpToDate = false;
    this._childrenCache = [];
  }
}
