import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import ConnectionTreeItem from './connectionTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { SavedConnection } from '../storage/storageController';

const rootLabel = 'Connections';
const rootTooltip = 'Your MongoDB connections';

export default class MDBConnectionsTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<vscode.TreeItem> {
  contextValue = 'mdbConnectionsTreeItem';

  private _connectionController: ConnectionController;
  private _connectionTreeItems: { [key: string]: any } = {};
  private _childrenCacheIsUpToDate = false;

  public isExpanded = true;

  constructor(connectionController: ConnectionController) {
    super(rootLabel, vscode.TreeItemCollapsibleState.Expanded);

    this._connectionController = connectionController;
  }

  get tooltip(): string {
    return rootTooltip;
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<vscode.TreeItem[]> {
    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(Object.values(this._connectionTreeItems));
    }

    const connectionIds = this._connectionController.getSavedConnections();
    const pastConnectionTreeItems = this._connectionTreeItems;
    this._connectionTreeItems = {};

    // Create new connection tree items, using cached children wherever possible.
    connectionIds.forEach((savedConnection: SavedConnection) => {
      const isActiveConnection =
        savedConnection.id ===
        this._connectionController.getActiveConnectionId();
      const isBeingConnectedTo =
        this._connectionController.isConnecting() &&
        savedConnection.id === this._connectionController.getConnectingConnectionId();

      let connectionExpandedState = isActiveConnection
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;

      if (
        pastConnectionTreeItems[savedConnection.id] &&
        !pastConnectionTreeItems[savedConnection.id].isExpanded
      ) {
        // Connection was manually collapsed while being active.
        connectionExpandedState = vscode.TreeItemCollapsibleState.Collapsed;
      }
      if (isActiveConnection && this._connectionController.isDisconnecting()) {
        // Don't show a collapsable state when the connection is being disconnected from.
        connectionExpandedState = vscode.TreeItemCollapsibleState.None;
      }
      if (isBeingConnectedTo) {
        // Don't show a collapsable state when the connection is being connected to.
        connectionExpandedState = vscode.TreeItemCollapsibleState.None;
      }

      this._connectionTreeItems[savedConnection.id] = new ConnectionTreeItem(
        savedConnection.id,
        connectionExpandedState,
        isActiveConnection,
        this._connectionController,
        pastConnectionTreeItems[savedConnection.id]
          ? pastConnectionTreeItems[savedConnection.id].getChildrenCache()
          : {}
      );
    });

    if (
      this._connectionController.isConnecting() &&
      !this._connectionController
        .isConnectionWithIdSaved(
          this._connectionController.getConnectingConnectionId()
        )
    ) {
      const notYetEstablishConnectionTreeItem = new vscode.TreeItem(
        this._connectionController.getConnectingConnectionName() || 'New Connection'
      );

      notYetEstablishConnectionTreeItem.description = 'connecting...';

      // When we're connecting to a new connection we add simple node showing the connecting status.
      this._connectionTreeItems._____connectingTempNode_____ = notYetEstablishConnectionTreeItem;
    }

    return Promise.resolve(Object.values(this._connectionTreeItems));
  }

  connectionsDidChange(): void {
    this._childrenCacheIsUpToDate = false;
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this.isExpanded = true;
    this._childrenCacheIsUpToDate = false;
    return Promise.resolve(true);
  }
}
