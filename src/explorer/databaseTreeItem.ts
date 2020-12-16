import * as vscode from 'vscode';
const ns = require('mongodb-ns');
import * as path from 'path';

import { StatusView } from '../views';

import CollectionTreeItem, { CollectionModelType } from './collectionTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { getImagesPath } from '../extensionConstants';
import { MongoClient } from 'mongodb';

function getIconPath(): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'database.svg'),
    dark: path.join(DARK, 'database.svg')
  };
}

type CollectionListResult = CollectionModelType[];

export default class DatabaseTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DatabaseTreeItem> {
  contextValue = 'databaseTreeItem';

  cacheIsUpToDate: boolean;
  private _childrenCache: { [collectionName: string]: CollectionTreeItem };

  private _dataService: MongoClient;

  databaseName: string;
  isExpanded: boolean;

  constructor(
    databaseName: string,
    dataService: MongoClient,
    isExpanded: boolean,
    cacheIsUpToDate: boolean,
    existingChildrenCache: { [key: string]: CollectionTreeItem }
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
    this._childrenCache = existingChildrenCache;

    this.iconPath = getIconPath();
    this.tooltip = this.databaseName;
  }

  getTreeItem(element: DatabaseTreeItem): DatabaseTreeItem {
    return element;
  }

  async listCollections(): Promise<CollectionListResult> {
    try {
      const collections: CollectionListResult = await this._dataService
        .db(this.databaseName)
        .listCollections()
        .toArray();

      return collections;
    } catch (err) {
      return Promise.reject(
        new Error(`Unable to list collections: ${err.message}`)
      );
    }
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
        this._childrenCache[collectionName] = new CollectionTreeItem(
          pastChildrenCache[collectionName].collection,
          this.databaseName,
          this._dataService,
          pastChildrenCache[collectionName].isExpanded,
          pastChildrenCache[collectionName].cacheIsUpToDate,
          pastChildrenCache[collectionName].documentCount,
          pastChildrenCache[collectionName].getDocumentListChild(),
          pastChildrenCache[collectionName].getSchemaChild(),
          pastChildrenCache[collectionName].getIndexListChild()
        );
      });

      return Object.values(this._childrenCache);
    }

    // List collections and build tree items.
    const collections: CollectionListResult = await this.listCollections();

    this.cacheIsUpToDate = true;

    if (collections && collections.length > 0) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};
      // Create new collection tree items, using previously cached items
      // where possible.
      collections
        .sort((collectionA: CollectionModelType, collectionB: CollectionModelType) =>
          (collectionA.name || '').localeCompare(collectionB.name || '')
        )
        .forEach((collection: CollectionModelType) => {
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

  async onAddCollectionClicked(
    context: vscode.ExtensionContext
  ): Promise<boolean> {
    const databaseName = this.databaseName;

    let collectionName: string | undefined;
    try {
      collectionName = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'e.g. myNewCollection',
        prompt: 'Enter the new collection name.',
        validateInput: (inputCollectionName: string) => {
          if (!inputCollectionName) {
            return null;
          }

          if (
            !ns(`${databaseName}.${inputCollectionName}`).validCollectionName
          ) {
            return 'MongoDB collection names cannot contain `/\\. "$` or the null character, and must be fewer than 64 characters';
          }

          if (ns(`${databaseName}.${inputCollectionName}`).system) {
            return 'MongoDB collection names cannot start with "system.". (Reserved for internal use.)';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.reject(
        new Error(`An error occured parsing the collection name: ${e}`)
      );
    }

    if (!collectionName) {
      return false;
    }

    const statusBarItem = new StatusView(context);
    statusBarItem.showMessage('Creating new collection...');

    try {
      await this._dataService
        .db(databaseName)
        .createCollection(collectionName);

      statusBarItem.hideMessage();

      this.cacheIsUpToDate = false;
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(
        `Create collection failed: ${err.message}`
      );
      return false;
    }
  }

  // Prompt the user to input the database name to confirm the drop, then drop.
  async onDropDatabaseClicked(): Promise<boolean> {
    const databaseName = this.databaseName;

    let inputtedDatabaseName: string | undefined;
    try {
      inputtedDatabaseName = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'e.g. myNewCollection',
        prompt: `Are you sure you wish to drop this database? Enter the database name '${databaseName}' to confirm.`,
        validateInput: (inputDatabaseName: string) => {
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
      return false;
    }

    try {
      await this._dataService.db(databaseName).dropDatabase();

      this.cacheIsUpToDate = false;
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(
        `Drop database failed: ${err.message}`
      );
      return false;
    }
  }
}
