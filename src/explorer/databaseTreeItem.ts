import * as vscode from 'vscode';
import path from 'path';
import type { DataService } from 'mongodb-data-service';

import CollectionTreeItem from './collectionTreeItem';
import type { CollectionDetailsType } from './collectionTreeItem';
import formatError from '../utils/formatError';
import { getImagesPath } from '../extensionConstants';
import type TreeItemParent from './treeItemParentInterface';

function getIconPath(): { light: vscode.Uri; dark: vscode.Uri } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: vscode.Uri.file(path.join(LIGHT, 'database.svg')),
    dark: vscode.Uri.file(path.join(DARK, 'database.svg')),
  };
}

export default class DatabaseTreeItem
  extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DatabaseTreeItem>
{
  contextValue = 'databaseTreeItem' as const;

  cacheIsUpToDate: boolean;
  private _childrenCache: { [collectionName: string]: CollectionTreeItem };

  private _dataService: DataService;

  databaseName: string;
  isExpanded: boolean;

  isDropped = false;

  constructor({
    databaseName,
    dataService,
    isExpanded,
    cacheIsUpToDate,
    childrenCache,
  }: {
    databaseName: string;
    dataService: DataService;
    isExpanded: boolean;
    cacheIsUpToDate: boolean;
    childrenCache: { [key: string]: CollectionTreeItem }; // Existing cache.
  }) {
    super(
      databaseName,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );

    this.databaseName = databaseName;
    this._dataService = dataService;

    this.isExpanded = isExpanded;
    this.cacheIsUpToDate = cacheIsUpToDate;
    this._childrenCache = childrenCache;

    this.iconPath = getIconPath();
    this.tooltip = this.databaseName;
  }

  getTreeItem(element: DatabaseTreeItem): DatabaseTreeItem {
    return element;
  }

  async getChildren(): Promise<any[]> {
    if (!this.isExpanded) {
      return [];
    }

    if (this.cacheIsUpToDate) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};

      // We manually rebuild each node to ensure we update the expanded state.
      Object.keys(pastChildrenCache).forEach((collectionName) => {
        const prevChild = pastChildrenCache[collectionName];

        if (prevChild.isDropped) {
          return;
        }

        this._childrenCache[collectionName] = new CollectionTreeItem({
          collection: prevChild.collection,
          databaseName: this.databaseName,
          dataService: this._dataService,
          isExpanded: prevChild.isExpanded,
          cacheIsUpToDate: prevChild.cacheIsUpToDate,
          cachedDocumentCount: prevChild.documentCount,
          existingDocumentListChild: prevChild.getDocumentListChild(),
          existingSchemaChild: prevChild.getSchemaChild(),
          existingIndexListChild: prevChild.getIndexListChild(),
          existingPreviewChild: prevChild.getPreviewChild(),
        });
      });

      return Object.values(this._childrenCache);
    }

    // List collections and build tree items.
    const collections = await this._dataService.listCollections(
      this.databaseName,
    );

    this.cacheIsUpToDate = true;

    if (collections && collections.length > 0) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};
      // Create new collection tree items, using previously cached items
      // where possible.

      const systemCollections: CollectionDetailsType[] = [];
      const otherCollections: CollectionDetailsType[] = [];

      collections.forEach((collection) => {
        if (collection.name.startsWith('system.')) {
          systemCollections.push(collection);
        } else {
          otherCollections.push(collection);
        }
      });

      const sortFunction = (
        collectionA: CollectionDetailsType,
        collectionB: CollectionDetailsType,
      ): number =>
        (collectionA.name || '').localeCompare(collectionB.name || '');

      const collectionTreeEntries = [
        ...otherCollections.sort(sortFunction),
        ...systemCollections.sort(sortFunction),
      ];

      collectionTreeEntries.forEach((collection) => {
        if (pastChildrenCache[collection.name]) {
          this._childrenCache[collection.name] = new CollectionTreeItem({
            collection,
            databaseName: this.databaseName,
            dataService: this._dataService,
            isExpanded: pastChildrenCache[collection.name].isExpanded,
            cacheIsUpToDate: pastChildrenCache[collection.name].cacheIsUpToDate,
            cachedDocumentCount:
              pastChildrenCache[collection.name].documentCount,
            existingDocumentListChild:
              pastChildrenCache[collection.name].getDocumentListChild(),
            existingSchemaChild:
              pastChildrenCache[collection.name].getSchemaChild(),
            existingIndexListChild:
              pastChildrenCache[collection.name].getIndexListChild(),
            existingPreviewChild:
              pastChildrenCache[collection.name].getPreviewChild(),
          });
        } else {
          this._childrenCache[collection.name] = new CollectionTreeItem({
            collection,
            databaseName: this.databaseName,
            dataService: this._dataService,
            isExpanded: false,
            cacheIsUpToDate: false, // No cache.
            cachedDocumentCount: null, // No document count yet.
          });
        }
      });
    } else {
      this._childrenCache = {};
    }

    return Object.values(this._childrenCache);
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

  resetCache(): void {
    this._childrenCache = {};
    this.cacheIsUpToDate = false;
  }

  getChildrenCache(): { [key: string]: CollectionTreeItem } {
    return this._childrenCache;
  }

  // Prompt the user to input the database name to confirm the drop, then drop.
  async onDropDatabaseClicked(): Promise<boolean> {
    const databaseName = this.databaseName;

    let inputtedDatabaseName;
    try {
      inputtedDatabaseName = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'e.g. myNewCollection',
        prompt: `Are you sure you wish to drop this database? Enter the database name '${databaseName}' to confirm.`,
        validateInput: (inputDatabaseName) => {
          if (
            inputDatabaseName &&
            !databaseName.startsWith(inputDatabaseName)
          ) {
            return 'Database name does not match';
          }

          return null;
        },
      });
    } catch (e) {
      return Promise.reject(
        new Error(
          `An error occurred parsing the database name: ${(e as Error).message}`,
        ),
      );
    }

    if (!inputtedDatabaseName || databaseName !== inputtedDatabaseName) {
      return Promise.resolve(false);
    }

    try {
      const successfullyDroppedDatabase =
        await this._dataService.dropDatabase(databaseName);

      this.isDropped = successfullyDroppedDatabase;

      return successfullyDroppedDatabase;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Drop database failed: ${formatError(error).message}`,
      );
      return false;
    }
  }
}
