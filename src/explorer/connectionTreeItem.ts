import * as vscode from 'vscode';
import path = require('path');

import DatabaseTreeItem from './databaseTreeItem';
import ConnectionController from '../connectionController';
import TreeItemParent from './treeItemParentInterface';
import { getImagesPath } from '../extensionConstants';

enum ConnectionItemContextValues {
  disconnected = 'disconnectedConnectionTreeItem',
  connected = 'connectedConnectionTreeItem',
}
export { ConnectionItemContextValues };

function getIconPath(isActiveConnection: boolean): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return isActiveConnection ? {
    light: path.join(LIGHT, 'connection-active.svg'),
    dark: path.join(DARK, 'connection-active.svg')
  } : {
    light: path.join(LIGHT, 'connection-inactive.svg'),
    dark: path.join(DARK, 'connection-inactive.svg')
  };
}

export default class ConnectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<ConnectionTreeItem> {
  contextValue = ConnectionItemContextValues.disconnected;

  private _childrenCache: { [key: string]: DatabaseTreeItem };
  cacheIsUpToDate: boolean;

  private _connectionController: ConnectionController;
  connectionId: string;

  isExpanded: boolean;

  constructor(
    connectionId: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    isExpanded: boolean,
    connectionController: ConnectionController,
    cacheIsUpToDate: boolean,
    existingChildrenCache: { [key: string]: DatabaseTreeItem }
  ) {
    super(
      connectionController.getSavedConnectionName(connectionId),
      collapsibleState
    );

    if (
      connectionController.getActiveConnectionId() === connectionId &&
      !connectionController.isDisconnecting() &&
      !connectionController.isConnecting()
    ) {
      this.contextValue = ConnectionItemContextValues.connected;
    }

    this.connectionId = connectionId;
    this._connectionController = connectionController;
    this.isExpanded = isExpanded;
    this._childrenCache = existingChildrenCache;
    this.cacheIsUpToDate = cacheIsUpToDate;

    // Create a unique id to ensure the tree updates the expanded property.
    // (Without an id it treats this tree item like a previous tree item with the same label).
    this.id = `${connectionId}-${Date.now()}`;

    this.tooltip = connectionController.getSavedConnectionName(this.connectionId);
    this.description = connectionController.getConnectionStatusStringForConnection(
      this.connectionId
    );
    this.iconPath = getIconPath(
      connectionController.getActiveConnectionId() === this.connectionId
    );
  }

  getTreeItem(element: ConnectionTreeItem): ConnectionTreeItem {
    return element;
  }

  async listDatabases(): Promise<any[]> {
    const dataService = this._connectionController.getActiveDataService();
    if (dataService === null) {
      throw new Error('Not currently connected.');
    }

    return new Promise((resolve, reject) => {
      dataService.listDatabases((err: Error | undefined, databases: any[]) => {
        if (err) {
          return reject(new Error(`Unable to list databases: ${err.message}`));
        }

        return resolve(databases);
      });
    });
  }

  async getChildren(): Promise<any[]> {
    if (
      !this.isExpanded ||
      this._connectionController.isDisconnecting() ||
      this._connectionController.isConnecting()
    ) {
      return [];
    }

    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      throw new Error('Not currently connected.');
    }

    if (this.cacheIsUpToDate) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};

      // We create a new database tree item here instead of reusing the
      // cached one in order to ensure the expanded state is set.
      Object.keys(pastChildrenCache).forEach((databaseName) => {
        const prevChild = pastChildrenCache[databaseName];

        if (prevChild.isDropped) {
          return;
        }

        this._childrenCache[databaseName] = new DatabaseTreeItem(
          databaseName,
          dataService,
          prevChild.isExpanded,
          prevChild.cacheIsUpToDate,
          prevChild.getChildrenCache()
        );
      });

      return Object.values(this._childrenCache);
    }

    const databases = await this.listDatabases();

    this.cacheIsUpToDate = true;

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
            pastChildrenCache[name].cacheIsUpToDate,
            pastChildrenCache[name].getChildrenCache()
          );
        } else {
          this._childrenCache[name] = new DatabaseTreeItem(
            name,
            dataService,
            false, // Collapsed.
            false, // Cache is not up to date (no cache).
            {} // No existing cache.
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

    if (
      this._connectionController.getActiveConnectionId() === this.connectionId
    ) {
      return Promise.resolve(true);
    }

    // If we aren't the active connection, we reconnect.
    return new Promise((resolve) => {
      this._connectionController
        .connectWithConnectionId(this.connectionId)
        .then(
          () => resolve(true),
          (err) => {
            this.isExpanded = false;
            vscode.window.showErrorMessage(err);
            return resolve(false);
          }
        );
    });
  }

  resetCache(): void {
    this._childrenCache = {};
    this.cacheIsUpToDate = false;
  }

  getChildrenCache(): { [key: string]: DatabaseTreeItem } {
    return this._childrenCache;
  }
}
