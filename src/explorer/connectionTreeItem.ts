import * as vscode from 'vscode';

import DatabaseTreeItem from './databaseTreeItem';
import ConnectionController from '../connectionController';
import TreeItemParent from './treeItemParentInterface';

export default class ConnectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<ConnectionTreeItem> {
  private _childrenCache: DatabaseTreeItem[] = [];
  private _childrenCacheIsUpToDate = false;

  private _connectionController: ConnectionController;
  private _connectionInstanceId: string;

  isExpanded: boolean;

  constructor(
    connectionInstanceId: string,
    isActiveConnection: boolean,
    connectionController: ConnectionController
  ) {
    super(
      connectionInstanceId,
      isActiveConnection
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this._connectionInstanceId = connectionInstanceId;
    this._connectionController = connectionController;
    this.isExpanded = isActiveConnection;

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

    return '';
  }

  getTreeItem(element: ConnectionTreeItem): ConnectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (this.isExpanded) {
      if (this._childrenCacheIsUpToDate) {
        return Promise.resolve(this._childrenCache);
      }

      return new Promise(async (resolve, reject) => {
        // If we aren't the active connection, we reconnect.
        if (
          this._connectionController.getActiveConnectionInstanceId() !==
          this._connectionInstanceId
        ) {
          try {
            await this._connectionController.connectWithInstanceId(
              this._connectionInstanceId
            );
          } catch (err) {
            return reject(err);
          }
        }

        const dataService = this._connectionController.getActiveConnection();
        dataService.listDatabases((err: any, databases: string[]) => {
          if (err) {
            return reject(`Unable to list databases: ${err}`);
          }

          this._childrenCacheIsUpToDate = true;

          if (databases) {
            this._childrenCache = databases.map(
              ({ name }: any) => new DatabaseTreeItem(name, dataService)
            );
          } else {
            this._childrenCache = [];
          }

          return resolve(this._childrenCache);
        });
      });
    }

    // Here we either want to return loading or nothing.
    return Promise.resolve([]);
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  async onDidExpand(): Promise<void> {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;
  }

  // Exposed for testing.
  public getIsExpanded(): boolean {
    return this.isExpanded;
  }
}
