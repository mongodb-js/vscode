import * as vscode from 'vscode';
import path from 'path';
import type { StreamProcessor } from 'mongodb-data-service/lib/data-service';

import DatabaseTreeItem from './databaseTreeItem';
import type ConnectionController from '../connectionController';
import formatError from '../utils/formatError';
import { getImagesPath } from '../extensionConstants';
import type TreeItemParent from './treeItemParentInterface';
import StreamProcessorTreeItem from './streamProcessorTreeItem';

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

  private _childrenCache: {
    [key: string]: DatabaseTreeItem | StreamProcessorTreeItem;
  };
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
    childrenCache: {
      [key: string]: DatabaseTreeItem | StreamProcessorTreeItem;
    }; // Existing cache.
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

  async listStreamProcessors(): Promise<StreamProcessor[]> {
    const dataService = this._connectionController.getActiveDataService();

    if (dataService === null) {
      throw new Error('Not currently connected.');
    }

    try {
      const processors = await dataService.listStreamProcessors();
      return processors;
    } catch (error) {
      throw new Error(
        `Unable to list stream processors: ${formatError(error).message}`
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

    const isAtlasStreams =
      this._connectionController.isConnectedToAtlasStreams();

    if (this.cacheIsUpToDate) {
      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};

      // We create a new tree item here instead of reusing the
      // cached one in order to ensure the expanded state is set.
      Object.keys(pastChildrenCache).forEach((childName) => {
        const prevChild = pastChildrenCache[childName];

        if (prevChild.isDropped) {
          return;
        }

        if (isAtlasStreams) {
          const spItem = prevChild as StreamProcessorTreeItem;
          this._childrenCache[childName] = new StreamProcessorTreeItem({
            dataService,
            isExpanded: spItem.isExpanded,
            streamProcessorName: spItem.streamProcessorName,
            streamProcessorState: spItem.streamProcessorState,
          });
        } else {
          const dbItem = prevChild as DatabaseTreeItem;
          this._childrenCache[childName] = new DatabaseTreeItem({
            databaseName: childName,
            dataService,
            isExpanded: dbItem.isExpanded,
            cacheIsUpToDate: dbItem.cacheIsUpToDate,
            childrenCache: dbItem.getChildrenCache(),
          });
        }
      });

      return Object.values(this._childrenCache);
    }

    if (isAtlasStreams) {
      const processors = await this.listStreamProcessors();
      processors.sort((a: StreamProcessor, b: StreamProcessor) => {
        return a.name.localeCompare(b.name);
      });

      this.cacheIsUpToDate = true;

      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};
      processors.forEach((sp) => {
        const cachedItem = pastChildrenCache[
          sp.name
        ] as StreamProcessorTreeItem;
        // We create a new element here instead of reusing the cached one
        // in order to ensure the expanded state is set.
        this._childrenCache[sp.name] = new StreamProcessorTreeItem({
          dataService,
          streamProcessorName: sp.name,
          streamProcessorState: sp.state,
          isExpanded: cachedItem ? cachedItem.isExpanded : false,
        });
      });
    } else {
      const databases = await this.listDatabases();
      databases.sort((a: string, b: string) => {
        return a.localeCompare(b);
      });

      this.cacheIsUpToDate = true;

      if (!databases) {
        this._childrenCache = {};
        return [];
      }

      const pastChildrenCache = this._childrenCache;
      this._childrenCache = {};

      databases.forEach((name: string) => {
        const cachedItem = pastChildrenCache[name] as DatabaseTreeItem;
        if (cachedItem) {
          // We create a new element here instead of reusing the cached one
          // in order to ensure the expanded state is set.
          this._childrenCache[name] = new DatabaseTreeItem({
            databaseName: name,
            dataService,
            isExpanded: cachedItem.isExpanded,
            cacheIsUpToDate: cachedItem.cacheIsUpToDate,
            childrenCache: cachedItem.getChildrenCache(),
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
    }

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

  getChildrenCache(): {
    [key: string]: DatabaseTreeItem | StreamProcessorTreeItem;
  } {
    return this._childrenCache;
  }
}
