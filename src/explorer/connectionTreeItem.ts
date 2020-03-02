import * as vscode from 'vscode';
const path = require('path');

import DatabaseTreeItem from './databaseTreeItem';
import ConnectionController from '../connectionController';
import TreeItemParent from './treeItemParentInterface';

export default class ConnectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<ConnectionTreeItem> {
  contextValue = 'connectionTreeItem';

  private _childrenCache: { [key: string]: DatabaseTreeItem };
  _childrenCacheIsUpToDate = false;

  private _connectionController: ConnectionController;
  connectionInstanceId: string;

  isExpanded: boolean;

  constructor(
    connectionInstanceId: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    isExpanded: boolean,
    connectionController: ConnectionController,
    existingChildrenCache: { [key: string]: DatabaseTreeItem }
  ) {
    super(
      connectionInstanceId,
      collapsibleState
    );

    this.connectionInstanceId = connectionInstanceId;
    this._connectionController = connectionController;
    this.isExpanded = isExpanded;
    this._childrenCache = existingChildrenCache;

    // Create a unique id to ensure the tree updates the expanded property.
    // (Without an id it treats this tree item like a previous tree item with the same label).
    this.id = `${Date.now()}-${connectionInstanceId}`;
  }

  get tooltip(): string {
    return this.connectionInstanceId;
  }

  get description(): string {
    if (
      this._connectionController.getActiveConnectionInstanceId() ===
      this.connectionInstanceId
    ) {
      if (this._connectionController.isDisconnecting()) {
        return 'disconnecting...';
      }

      return 'connected';
    }

    if (this._connectionController.isConnnecting()
      && this._connectionController.getConnectingInstanceId() === this.connectionInstanceId
    ) {
      return 'connecting...';
    }

    return '';
  }

  getTreeItem(element: ConnectionTreeItem): ConnectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.isExpanded
      || this._connectionController.isDisconnecting()
      || this._connectionController.isConnnecting()
    ) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(Object.values(this._childrenCache));
    }

    return new Promise((resolve, reject) => {
      const dataService = this._connectionController.getActiveConnection();
      dataService.listDatabases((err: any, databases: string[]) => {
        if (err) {
          return reject(new Error(`Unable to list databases: ${err}`));
        }

        this._childrenCacheIsUpToDate = true;

        if (databases) {
          const pastChildrenCache = this._childrenCache;
          this._childrenCache = {};

          databases.forEach(({ name }: any) => {
            if (pastChildrenCache[name]) {
              // We create a new element here instead of reusing the cached one
              // in order to ensure the expanded state is set.
              this._childrenCache[name] = new DatabaseTreeItem(
                name,
                dataService,
                pastChildrenCache[name].isExpanded,
                pastChildrenCache[name].getChildrenCache()
              );
            } else {
              this._childrenCache[name] = new DatabaseTreeItem(
                name,
                dataService,
                false, // Collapsed.
                {} // No existing cache.
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

  public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    return this._connectionController.getActiveConnectionInstanceId() === this.connectionInstanceId
      ? {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'active-connection.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'active-connection.svg')
      }
      : {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'inactive-connection.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'inactive-connection.svg')
      };
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;

    if (this._connectionController.getActiveConnectionInstanceId() === this.connectionInstanceId) {
      return Promise.resolve(true);
    }

    // If we aren't the active connection, we reconnect.
    return new Promise(resolve => {
      this._connectionController.connectWithInstanceId(this.connectionInstanceId).then(
        () => resolve(true),
        err => {
          this.isExpanded = false;
          vscode.window.showErrorMessage(err);
          resolve(false);
        }
      );
    });
  }

  setCacheExpired(): void {
    this._childrenCacheIsUpToDate = false;
  }

  public getChildrenCache(): { [key: string]: DatabaseTreeItem } {
    return this._childrenCache;
  }
}
