import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import ConnectionTreeItem from './connectionTreeItem';
import TreeItemParent from './treeItemParentInterface';

const rootLabel = 'Connections';
const rootTooltip = 'Your MongoDB connections';

export default class ExplorerRootTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<vscode.TreeItem> {
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

    const connectionIds = this._connectionController.getConnectionInstanceIds();
    const pastConnectionTreeItems = this._connectionTreeItems;
    this._connectionTreeItems = {};

    // Create new connection tree items, using cached children whereever possible.
    connectionIds.forEach(connectionId => {
      const isActiveConnection = connectionId === this._connectionController.getActiveConnectionInstanceId();
      const isBeingConnectedTo = this._connectionController.isConnnecting() && connectionId === this._connectionController.getConnectingInstanceId();

      let connectionExpandedState = isActiveConnection ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
      if (pastConnectionTreeItems[connectionId] && !pastConnectionTreeItems[connectionId].isExpanded) {
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

      this._connectionTreeItems[connectionId] = new ConnectionTreeItem(
        connectionId,
        connectionExpandedState,
        isActiveConnection,
        this._connectionController,
        pastConnectionTreeItems[connectionId] ? pastConnectionTreeItems[connectionId].getChildrenCache() : {}
      );
    });

    if (this._connectionController.isConnnecting() && this._connectionController.getConnectionInstanceIds().indexOf(this._connectionController.getConnectingInstanceId()) === -1) {
      const notYetEstablishConnectionTreeItem = new vscode.TreeItem(
        this._connectionController.getConnectingInstanceId()
      );

      notYetEstablishConnectionTreeItem.description = 'connecting...';

      // When we're connecting to a new connection we add simple node showing the connecting status.
      this._connectionTreeItems['_____connecting_temp_node_____'] = notYetEstablishConnectionTreeItem;
    }

    return Promise.resolve(Object.values(this._connectionTreeItems));
  }

  connectionsDidChange() {
    this._childrenCacheIsUpToDate = false;
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): Promise<any> {
    this.isExpanded = true;
    this._childrenCacheIsUpToDate = false;
    return Promise.resolve(true);
  }
}
