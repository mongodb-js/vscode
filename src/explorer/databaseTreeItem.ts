import * as vscode from 'vscode';
const ns = require('mongodb-ns');
const path = require('path');

import { StatusView } from '../views';

import CollectionTreeItem from './collectionTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { getImagesPath } from '../extensionConstants';

export default class DatabaseTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DatabaseTreeItem> {
  contextValue = 'databaseTreeItem';

  cacheIsUpToDate: boolean;
  private _childrenCache: { [collectionName: string]: CollectionTreeItem };

  private _dataService: any;

  databaseName: string;
  isExpanded: boolean;

  constructor(
    databaseName: string,
    dataService: any,
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
  }

  get tooltip(): string {
    return this.databaseName;
  }

  getTreeItem(element: DatabaseTreeItem): DatabaseTreeItem {
    return element;
  }

  listCollections(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this._dataService.listCollections(
        this.databaseName,
        {}, // No filter.
        (err: Error | undefined, collections: string[]) => {
          if (err) {
            return reject(
              new Error(`Unable to list collections: ${err.message}`)
            );
          }

          return resolve(collections);
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
    const collections = await this.listCollections();

    this.cacheIsUpToDate = true;

    if (collections && collections.length > 0) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};
      // Create new collection tree items, using previously cached items
      // where possible.
      collections
        .sort((collectionA: any, collectionB: any) =>
          (collectionA.name || '').localeCompare(collectionB.name || '')
        )
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

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(getImagesPath(), 'light');
    const DARK = path.join(getImagesPath(), 'dark');

    return {
      light: path.join(LIGHT, 'database.svg'),
      dark: path.join(DARK, 'database.svg')
    };
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

    let collectionName;
    try {
      collectionName = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'e.g. myNewCollection',
        prompt: 'Enter the new collection name.',
        validateInput: (inputCollectionName: any) => {
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
      return Promise.resolve(false);
    }

    const statusBarItem = new StatusView(context);
    statusBarItem.showMessage('Creating new collection...');

    return new Promise((resolve) => {
      this._dataService.createCollection(
        `${databaseName}.${collectionName}`,
        {}, // No options.
        (err) => {
          statusBarItem.hideMessage();

          if (err) {
            vscode.window.showErrorMessage(
              `Create collection failed: ${err.message}`
            );
            return resolve(false);
          }

          this.cacheIsUpToDate = false;
          return resolve(true);
        }
      );
    });
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

    return new Promise((resolve) => {
      this._dataService.dropDatabase(databaseName, (err) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Drop database failed: ${err.message}`
          );
          return resolve(false);
        }

        this.cacheIsUpToDate = false;
        return resolve(true);
      });
    });
  }
}
