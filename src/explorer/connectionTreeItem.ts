import * as vscode from 'vscode';
import path from 'path';

import DatabaseTreeItem from './databaseTreeItem';
import ConnectionController from '../connectionController';
import formatError from '../utils/formatError';
import { getImagesPath } from '../extensionConstants';
import TreeItemParent from './treeItemParentInterface';

export enum ConnectionItemContextValues {
  disconnected = 'disconnectedConnectionTreeItem',
  connected = 'connectedConnectionTreeItem',
}

function getIconPath(isActiveConnection: boolean): {
  light: string;
  dark: string;
} {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return isActiveConnection
    ? {
        light: path.join(LIGHT, 'connection-active.svg'),
        dark: path.join(DARK, 'connection-active.svg'),
      }
    : {
        light: path.join(LIGHT, 'connection-inactive.svg'),
        dark: path.join(DARK, 'connection-inactive.svg'),
      };
}

export default class ConnectionTreeItem
  extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<ConnectionTreeItem>
{
  contextValue = ConnectionItemContextValues.disconnected;

  private _childrenCache: { [key: string]: DatabaseTreeItem };
  cacheIsUpToDate: boolean;

  private _connectionController: ConnectionController;
  connectionId: string;

  isExpanded: boolean;

  constructor({
    connectionId,
    collapsibleState,
    isExpanded,
    connectionController,
    cacheIsUpToDate,
    childrenCache,
  }: {
    connectionId: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
    isExpanded: boolean;
    connectionController: ConnectionController;
    cacheIsUpToDate: boolean;
    childrenCache: { [key: string]: DatabaseTreeItem }; // Existing cache.
  }) {
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
    this._childrenCache = childrenCache;
    this.cacheIsUpToDate = cacheIsUpToDate;

    // Create a unique id to ensure the tree updates the expanded property.
    // (Without an id it treats this tree item like a previous tree item with the same label).
    this.id = `${connectionId}-${Date.now()}`;

    this.tooltip = connectionController.getSavedConnectionName(
      this.connectionId
    );
    this.description =
      connectionController.getConnectionStatusStringForConnection(
        this.connectionId
      );
    this.iconPath = getIconPath(
      connectionController.getActiveConnectionId() === this.connectionId
    );
  }

  getTreeItem(element: ConnectionTreeItem): ConnectionTreeItem {
    return element;
  }

  async listDatabases(): Promise<string[]> {
    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      throw new Error('Not currently connected.');
    }

    try {
      const dbs = await dataService.listDatabases({
        nameOnly: true,
      });

      return dbs.map((dbItem) => dbItem.name);
    } catch (error) {
      throw new Error(
        `Unable to list databases: ${formatError(error).message}`
      );
    }
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

        this._childrenCache[databaseName] = new DatabaseTreeItem({
          databaseName,
          dataService,
          isExpanded: prevChild.isExpanded,
          cacheIsUpToDate: prevChild.cacheIsUpToDate,
          childrenCache: prevChild.getChildrenCache(),
        });
      });

      return Object.values(this._childrenCache);
    }

    const databases = await this.listDatabases();

    this.cacheIsUpToDate = true;

    if (!databases) {
      this._childrenCache = {};
      return [];
    }

    const pastChildrenCache = this._childrenCache;
    this._childrenCache = {};

    databases.forEach((name: string) => {
      if (pastChildrenCache[name]) {
        // We create a new element here instead of reusing the cached one
        // in order to ensure the expanded state is set.
        this._childrenCache[name] = new DatabaseTreeItem({
          databaseName: name,
          dataService,
          isExpanded: pastChildrenCache[name].isExpanded,
          cacheIsUpToDate: pastChildrenCache[name].cacheIsUpToDate,
          childrenCache: pastChildrenCache[name].getChildrenCache(),
        });
      } else {
        this._childrenCache[name] = new DatabaseTreeItem({
          databaseName: name,
          dataService,
          isExpanded: false,
          cacheIsUpToDate: false, // Cache is not up to date (no cache).
          childrenCache: {}, // No existing cache.
        });
      }
    });

    return Object.values(this._childrenCache);
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this.cacheIsUpToDate = false;
  }

  async onDidExpand(): Promise<boolean> {
    this.cacheIsUpToDate = false;
    this.isExpanded = true;

    if (
      this._connectionController.getActiveConnectionId() === this.connectionId
    ) {
      return true;
    }

    // If we aren't the active connection, we reconnect.
    try {
      const connectSuccess =
        await this._connectionController.connectWithConnectionId(
          this.connectionId
        );
      return connectSuccess;
    } catch (err) {
      this.isExpanded = false;
      void vscode.window.showErrorMessage(
        (err as Error).message || (err as string)
      );

      return false;
    }
  }

  resetCache(): void {
    this._childrenCache = {};
    this.cacheIsUpToDate = false;
  }

  getChildrenCache(): { [key: string]: DatabaseTreeItem } {
    return this._childrenCache;
  }
}
