import * as vscode from 'vscode';
const ns = require('mongodb-ns');
const path = require('path');

import CollectionTreeItem, { MAX_DOCUMENTS_VISIBLE } from './collectionTreeItem';
import TreeItemParent from './treeItemParentInterface';

export default class DatabaseTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<DatabaseTreeItem> {
  contextValue = 'databaseTreeItem';

  _childrenCacheIsUpToDate = false;
  private _childrenCache: { [collectionName: string]: CollectionTreeItem };

  private _dataService: any;

  databaseName: string;
  isExpanded: boolean;

  constructor(
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
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
    this._childrenCache = existingChildrenCache;
  }

  get tooltip(): string {
    return this.databaseName;
  }

  getTreeItem(element: DatabaseTreeItem): DatabaseTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.isExpanded) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(Object.values(this._childrenCache));
    }

    return new Promise((resolve, reject) => {
      this._dataService.listCollections(
        this.databaseName,
        {}, // No filter.
        (err: any, collections: string[]) => {
          if (err) {
            return reject(new Error(`Unable to list collections: ${err}`));
          }

          this._childrenCacheIsUpToDate = true;

          if (collections) {
            const pastChildrenCache = this._childrenCache;
            this._childrenCache = {};
            // Create new collection tree items, using previously cached items
            // where possible.
            collections.forEach((collection: any) => {
              if (pastChildrenCache[collection.name]) {
                this._childrenCache[collection.name] = new CollectionTreeItem(
                  collection,
                  this.databaseName,
                  this._dataService,
                  pastChildrenCache[collection.name].isExpanded,
                  pastChildrenCache[collection.name].getChildrenCache(),
                  pastChildrenCache[collection.name].getMaxDocumentsToShow()
                );
              } else {
                this._childrenCache[collection.name] = new CollectionTreeItem(
                  collection,
                  this.databaseName,
                  this._dataService,
                  false, // Not expanded.
                  [], // No cached documents.
                  MAX_DOCUMENTS_VISIBLE
                );
              }
            });
          } else {
            this._childrenCache = {};
          }

          return resolve(Object.values(this._childrenCache));
        });
    });
  }

  get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    return {
      light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'database.svg'),
      dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'database.svg')
    };
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

  setCacheExpired(): void {
    this._childrenCacheIsUpToDate = false;
  }

  getChildrenCache(): { [key: string]: CollectionTreeItem } {
    return this._childrenCache;
  }

  async onAddCollectionClicked(): Promise<boolean> {
    const databaseName = this.databaseName;

    let collectionName;
    try {
      collectionName = await vscode.window.showInputBox({
        value: '',
        placeHolder:
          'e.g. myNewCollection',
        prompt: 'Enter the new collection name.',
        validateInput: (inputCollectionName: any) => {
          if (!inputCollectionName) {
            return null;
          }

          if (!ns(`${databaseName}.${inputCollectionName}`).validCollectionName) {
            return 'MongoDB collection names cannot contain `/\\. "$` or the null character, and must be fewer than 64 characters';
          }

          if (ns(`${databaseName}.${inputCollectionName}`).system) {
            return 'MongoDB collection names cannot start with "system.". (Reserved for internal use.)';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.reject(`An error occured parsing the collection name: ${e}`);
    }

    if (!collectionName) {
      return Promise.resolve(false);
    }

    return new Promise((resolve, reject) => {
      this._dataService.createCollection(
        `${databaseName}.${collectionName}`,
        {}, // No options.
        (err) => {
          if (err) {
            return reject(new Error(`Create collection failed: ${err}`));
          }

          this.setCacheExpired();
          return resolve(true);
        }
      );
    });
  }
}
