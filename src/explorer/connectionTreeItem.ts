import * as vscode from 'vscode';

import DatabaseTreeItem from './databaseTreeItem';
import ConnectionController from '../connectionController';
import TreeItemParent from './treeItemParentInterface';

export default class ConnectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<ConnectionTreeItem> {
  private _childrenCache: { [key: string]: DatabaseTreeItem };
  private _childrenCacheIsUpToDate = false;

  private _connectionController: ConnectionController;
  private _connectionInstanceId: string;

  public isExpanded: boolean;

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

    this._connectionInstanceId = connectionInstanceId;
    this._connectionController = connectionController;
    this.isExpanded = isExpanded;
    this._childrenCache = existingChildrenCache;

    // Create a unique id to ensure the tree updates the expanded property.
    // (Without an id it treats this tree item like a previous tree item with the same label).
    this.id = `${Date.now()}-${connectionInstanceId}`;
  }

  get tooltip(): string {
    return this._connectionInstanceId;
  }

  get description(): string {
    if (
      this._connectionController.getActiveConnectionInstanceId() ===
      this._connectionInstanceId
    ) {
      if (this._connectionController.isDisconnecting()) {
        return 'disconnecting...';
      }

      return 'connected';
    }

    if (this._connectionController.isConnnecting() && this._connectionController.getConnectingInstanceId() === this._connectionInstanceId) {
      return 'connecting...';
    }

    return '';
  }

  getTreeItem(element: ConnectionTreeItem): ConnectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.isExpanded || this._connectionController.isDisconnecting() || this._connectionController.isConnnecting()) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(Object.values(this._childrenCache));
    }

    return new Promise((resolve, reject) => {
      const dataService = this._connectionController.getActiveConnection();
      dataService.listDatabases((err: any, databases: string[]) => {
        if (err) {
          return reject(`Unable to list databases: ${err}`);
        }

        this._childrenCacheIsUpToDate = true;

        if (databases) {
          const pastChildrenCache = {
            ...this._childrenCache
          };
          this._childrenCache = {};

          databases.forEach(({ name }: any) => {
            this._childrenCache[name] = pastChildrenCache[name]
              ? new DatabaseTreeItem(name, dataService, pastChildrenCache[name].isExpanded, pastChildrenCache[name].getChildrenCache())
              : new DatabaseTreeItem(name, dataService, false /* Collapsed */, {});
          });
        } else {
          this._childrenCache = {};
        }

        return resolve(Object.values(this._childrenCache));
      });
    });
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): Promise<any> {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;

    // If we aren't the active connection, we reconnect.
    if (this._connectionController.getActiveConnectionInstanceId() !== this._connectionInstanceId) {
      return new Promise((resolve, reject) => {
        this._connectionController.connectWithInstanceId(this._connectionInstanceId).then(() => resolve(true), err => {
          this.isExpanded = false;
          vscode.window.showErrorMessage(err);
          reject(err);
        });
      });
    }

    return Promise.resolve(true);
  }

  public getChildrenCache(): { [key: string]: DatabaseTreeItem } {
    return this._childrenCache;
  }
}
