import * as util from 'util';
import * as vscode from 'vscode';
import path from 'path';

import CollectionTreeItem from './collectionTreeItem';
import { getImagesPath } from '../extensionConstants';
import TreeItemParent from './treeItemParentInterface';

function getIconPath(): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'database.svg'),
    dark: path.join(DARK, 'database.svg')
  };
}

export default class DatabaseTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DatabaseTreeItem> {
  contextValue = 'databaseTreeItem' as const;

  cacheIsUpToDate: boolean;
  private _childrenCache: { [collectionName: string]: CollectionTreeItem };

  private _dataService: any;

  databaseName: string;
  isExpanded: boolean;

  isDropped = false;

  constructor(
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    cacheIsUpToDate: boolean,
    childrenCache: { [key: string]: CollectionTreeItem } // Existing cache.
  ) {
    super(
      databaseName,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
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

        this._childrenCache[collectionName] = new CollectionTreeItem(
          prevChild.collection,
          this.databaseName,
          this._dataService,
          prevChild.isExpanded,
          prevChild.cacheIsUpToDate,
          prevChild.documentCount,
          prevChild.getDocumentListChild(),
          prevChild.getSchemaChild(),
          prevChild.getIndexListChild()
        );
      });

      return Object.values(this._childrenCache);
    }

    // List collections and build tree items.
    const collections = await this._dataService.listCollections(this.databaseName);

    this.cacheIsUpToDate = true;

    if (collections && collections.length > 0) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};
      // Create new collection tree items, using previously cached items
      // where possible.

      const systemCollections: string[] = [];
      const otherCollections: string[] = [];

      collections.forEach(collection => {
        if (collection.name.startsWith('system.')) {
          systemCollections.push(collection);
        } else {
          otherCollections.push(collection);
        }
      });

      const sortFunction = (collectionA: any, collectionB: any) => (collectionA.name || '').localeCompare(collectionB.name || '');

      const collectionTreeEntries = [
        ...otherCollections.sort(sortFunction),
        ...systemCollections.sort(sortFunction)
      ];

      collectionTreeEntries
        .forEach((collection: any) => {
          if (pastChildrenCache[collection.name]) {
            this._childrenCache[collection.name] = new CollectionTreeItem(
              collection,
              this.databaseName,
              this._dataService,
              pastChildrenCache[collection.name].isExpanded,
              pastChildrenCache[collection.name].cacheIsUpToDate,
              pastChildrenCache[collection.name].documentCount,
              pastChildrenCache[collection.name].getDocumentListChild(),
              pastChildrenCache[collection.name].getSchemaChild(),
              pastChildrenCache[collection.name].getIndexListChild()
            );
          } else {
            this._childrenCache[collection.name] = new CollectionTreeItem(
              collection,
              this.databaseName,
              this._dataService,
              false, // Not expanded.
              false, // No cache.
              null // No document count yet.
            );
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
        validateInput: (inputDatabaseName: any) => {
          if (
            inputDatabaseName &&
            !databaseName.startsWith(inputDatabaseName)
          ) {
            return 'Database name does not match';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.reject(
        new Error(`An error occured parsing the database name: ${e}`)
      );
    }

    if (!inputtedDatabaseName || databaseName !== inputtedDatabaseName) {
      return Promise.resolve(false);
    }

    try {
      const dropDatabase = util.promisify(
        this._dataService.dropDatabase.bind(this._dataService)
      );
      const successfullyDroppedDatabase = await dropDatabase(
        databaseName
      );

      this.isDropped = successfullyDroppedDatabase;

      return successfullyDroppedDatabase;
    } catch (error) {
      const printableError = error as { message: string };
      void vscode.window.showErrorMessage(
        `Drop database failed: ${printableError.message}`
      );
      return false;
    }
  }
}
