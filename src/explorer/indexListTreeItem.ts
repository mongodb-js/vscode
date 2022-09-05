import * as util from 'util';
import * as vscode from 'vscode';
import { DataService } from 'mongodb-data-service';
import path from 'path';

import formatError from '../utils/formatError';
import { getImagesPath } from '../extensionConstants';
import IndexTreeItem, { IndexModel } from './indexTreeItem';
import { sortTreeItemsByLabel } from './treeItemUtils';
import TreeItemParent from './treeItemParentInterface';

const ITEM_LABEL = 'Indexes';

function getIconPath(): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'indexes.svg'),
    dark: path.join(DARK, 'indexes.svg'),
  };
}

export default class IndexListTreeItem
  extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<IndexListTreeItem>
{
  collectionName: string;
  databaseName: string;
  isExpanded: boolean;

  cacheIsUpToDate = false;
  contextValue = 'indexListTreeItem' as const;

  private _namespace: string;
  private _dataService: DataService;

  private _childrenCache: IndexTreeItem[] = [];

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: DataService,
    isExpanded: boolean,
    cacheIsUpToDate: boolean,
    childrenCache: IndexTreeItem[] // Existing cache.
  ) {
    super(
      ITEM_LABEL,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.collectionName = collectionName;
    this.databaseName = databaseName;
    this._namespace = `${databaseName}.${collectionName}`;
    this._dataService = dataService;
    this.isExpanded = isExpanded;
    this.cacheIsUpToDate = cacheIsUpToDate;
    this._childrenCache = childrenCache;

    this.iconPath = getIconPath();
    this.tooltip = 'Collection Indexes';
  }

  getTreeItem(element: IndexListTreeItem): IndexListTreeItem {
    return element;
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

    this.cacheIsUpToDate = true;
    this._childrenCache = [];

    let indexes;

    try {
      const fetchIndexes = util.promisify(
        this._dataService.indexes.bind(this._dataService)
      );
      indexes = await fetchIndexes(
        this._namespace,
        {} // No options.
      );
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Fetch indexes failed: ${formatError(error).message}`
      );
      return [];
    }

    if (indexes) {
      this._childrenCache = sortTreeItemsByLabel(
        indexes.map((index: IndexModel) => {
          return new IndexTreeItem(
            index,
            this._namespace,
            false /* Not expanded. */
          );
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
