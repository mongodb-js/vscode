import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import ConnectionTreeItem from './connectionTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { SavedConnection } from '../storage/storageController';

const rootLabel = 'Connections';
const rootTooltip = 'Your MongoDB connections';

function sortTreeItemsByLabel(treeItems: vscode.TreeItem[]): vscode.TreeItem[] {
  return treeItems.sort(
    (
      a: vscode.TreeItem,
      b: vscode.TreeItem
    ) => (a.label || '').localeCompare(b.label || '')
  );
}

export default class MDBConnectionsTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<vscode.TreeItem> {
  contextValue = 'mdbConnectionsTreeItem';

  private _connectionController: ConnectionController;
  private _connectionTreeItems: { [key: string]: ConnectionTreeItem } = {};

  isExpanded = true;
  needsToRefreshExpansionState = false;

  constructor(
    connectionController: ConnectionController,
    existingConnectionItemsCache?: { [key: string]: ConnectionTreeItem }
  ) {
    super(rootLabel, vscode.TreeItemCollapsibleState.Expanded);

    this._connectionController = connectionController;

    if (existingConnectionItemsCache) {
      this._connectionTreeItems = existingConnectionItemsCache;
    }

    // Ensure we refresh the connections when this node is built.
    this.id = `${Date.now()}`;
  }

  get tooltip(): string {
    return rootTooltip;
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<vscode.TreeItem[]> {
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
        savedConnection.id ===
          this._connectionController.getConnectingConnectionId();

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
      !this._connectionController.isConnectionWithIdSaved(
        this._connectionController.getConnectingConnectionId()
      )
    ) {
      const notYetEstablishConnectionTreeItem = new vscode.TreeItem(
        this._connectionController.getConnectingConnectionName() ||
          'New Connection'
      );

      notYetEstablishConnectionTreeItem.description = 'connecting...';

      // When we're connecting to a new connection we add simple node showing the connecting status.
      return Promise.resolve(
        sortTreeItemsByLabel([
          ...Object.values(this._connectionTreeItems),
          notYetEstablishConnectionTreeItem
        ])
      );
    }

    return Promise.resolve(
      sortTreeItemsByLabel(Object.values(this._connectionTreeItems))
    );
  }

  connectionsDidChange(): void {
    // When the connections change, like a connection is added or removed,
    // we want to open the connections dropdown if it's collapsed.
    if (!this.isExpanded) {
      this.needsToRefreshExpansionState = true;
    }
  }

  onDidCollapse(): void {
    this.isExpanded = false;
  }

  onDidExpand(): Promise<boolean> {
    this.isExpanded = true;
    return Promise.resolve(true);
  }

  getConnectionItemsCache(): { [key: string]: ConnectionTreeItem } {
    return this._connectionTreeItems;
  }
}
