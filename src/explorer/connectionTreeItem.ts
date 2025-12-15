import * as vscode from 'vscode';
import path from 'path';
import type {
  DataService,
  StreamProcessor,
} from 'mongodb-data-service/lib/data-service';

import DatabaseTreeItem from './databaseTreeItem';
import type ConnectionController from '../connectionController';
import formatError from '../utils/formatError';
import { getImagesPath } from '../extensionConstants';
import type TreeItemParent from './treeItemParentInterface';
import StreamProcessorTreeItem from './streamProcessorTreeItem';
import type { ConnectionSource } from '../storage/connectionStorage';

export type ConnectionItemContextValue = `${'disconnected' | 'connected'}${
  | ''
  | 'Preset'}ConnectionTreeItem`;

function getIconPath(isActiveConnection: boolean): {
  light: vscode.Uri;
  dark: vscode.Uri;
} {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return isActiveConnection
    ? {
        light: vscode.Uri.file(path.join(LIGHT, 'connection-active.svg')),
        dark: vscode.Uri.file(path.join(DARK, 'connection-active.svg')),
      }
    : {
        light: vscode.Uri.file(path.join(LIGHT, 'connection-inactive.svg')),
        dark: vscode.Uri.file(path.join(DARK, 'connection-inactive.svg')),
      };
}

export default class ConnectionTreeItem
  extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<ConnectionTreeItem>
{
  contextValue: ConnectionItemContextValue = 'disconnectedConnectionTreeItem';

  private _childrenCache: {
    [key: string]: DatabaseTreeItem | StreamProcessorTreeItem;
  };
  cacheIsUpToDate: boolean;

  private _connectionController: ConnectionController;
  connectionId: string;

  isExpanded: boolean;
  source: ConnectionSource;

  constructor({
    connectionId,
    collapsibleState,
    isExpanded,
    connectionController,
    cacheIsUpToDate,
    childrenCache,
    source,
  }: {
    connectionId: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
    isExpanded: boolean;
    connectionController: ConnectionController;
    cacheIsUpToDate: boolean;
    childrenCache: {
      [key: string]: DatabaseTreeItem | StreamProcessorTreeItem;
    }; // Existing cache.
    source: ConnectionSource;
  }) {
    super(
      connectionController.getSavedConnectionName(connectionId),
      collapsibleState,
    );

    const isConnected =
      connectionController.getActiveConnectionId() === connectionId &&
      !connectionController.isDisconnecting() &&
      !connectionController.isConnecting();

    this.contextValue = `${isConnected ? 'connected' : 'disconnected'}${
      source === 'user' ? '' : 'Preset'
    }ConnectionTreeItem`;

    this.connectionId = connectionId;
    this.source = source;
    this._connectionController = connectionController;
    this.isExpanded = isExpanded;
    this._childrenCache = childrenCache;
    this.cacheIsUpToDate = cacheIsUpToDate;

    // Create a unique id to ensure the tree updates the expanded property.
    // (Without an id it treats this tree item like a previous tree item with the same label).
    this.id = `${connectionId}-${Date.now()}`;

    this.tooltip = connectionController.getSavedConnectionName(
      this.connectionId,
    );
    this.description =
      connectionController.getConnectionStatusStringForConnection(
        this.connectionId,
      );
    this.iconPath = getIconPath(
      connectionController.getActiveConnectionId() === this.connectionId,
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
        `Unable to list databases: ${formatError(error).message}`,
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
        `Unable to list stream processors: ${formatError(error).message}`,
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

    this._childrenCache = await (isAtlasStreams
      ? this._buildChildrenCacheForStreams(dataService)
      : this._buildChildrenCacheForDatabases(dataService));
    this.cacheIsUpToDate = true;
    return Object.values(this._childrenCache);
  }

  private async _buildChildrenCacheForDatabases(
    dataService: DataService,
  ): Promise<Record<string, DatabaseTreeItem>> {
    const databases = await this.listDatabases();
    databases.sort((a: string, b: string) => a.localeCompare(b));

    const newChildrenCache: Record<string, DatabaseTreeItem> = {};

    databases.forEach((databaseName: string) => {
      const cachedItem = this._childrenCache[databaseName] as DatabaseTreeItem;
      // We create a new element here instead of reusing the cached one
      // in order to ensure the expanded state is set.
      newChildrenCache[databaseName] = new DatabaseTreeItem({
        dataService,
        databaseName,
        isExpanded: cachedItem ? cachedItem.isExpanded : false,
        cacheIsUpToDate: cachedItem ? cachedItem.cacheIsUpToDate : false,
        childrenCache: cachedItem ? cachedItem.getChildrenCache() : {},
      });
    });

    return newChildrenCache;
  }

  private async _buildChildrenCacheForStreams(
    dataService: DataService,
  ): Promise<Record<string, StreamProcessorTreeItem>> {
    const processors = await this.listStreamProcessors();
    processors.sort((a, b) => a.name.localeCompare(b.name));

    const newChildrenCache: Record<string, StreamProcessorTreeItem> = {};

    processors.forEach((sp) => {
      const cachedItem = this._childrenCache[
        sp.name
      ] as StreamProcessorTreeItem;
      // We create a new element here instead of reusing the cached one
      // in order to ensure the expanded state is set.
      newChildrenCache[sp.name] = new StreamProcessorTreeItem({
        dataService,
        streamProcessorName: sp.name,
        streamProcessorState: sp.state,
        isExpanded: cachedItem ? cachedItem.isExpanded : false,
      });
    });

    return newChildrenCache;
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
      const { successfullyConnected } =
        await this._connectionController.connectWithConnectionId(
          this.connectionId,
        );
      return successfullyConnected;
    } catch (err) {
      this.isExpanded = false;
      void vscode.window.showErrorMessage(
        (err as Error).message || (err as string),
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
