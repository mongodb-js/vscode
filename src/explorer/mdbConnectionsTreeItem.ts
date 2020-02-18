import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import ConnectionTreeItem from './connectionTreeItem';
import TreeItemParent from './treeItemParentInterface';

const rootLabel = 'Connections';
const rootTooltip = 'Your MongoDB connections';

export default class ExplorerRootTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<vscode.TreeItem> {
  private _connectionController: ConnectionController;
  private _connectionTreeItems: vscode.TreeItem[] = [];

  isExpanded: boolean;

  constructor(connectionController: ConnectionController) {
    super(rootLabel, vscode.TreeItemCollapsibleState.Expanded);

    this._connectionController = connectionController;
    this.loadConnections();

    this.isExpanded = true;
  }

  get tooltip(): string {
    return rootTooltip;
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<vscode.TreeItem[]> {
    return Promise.resolve(this._connectionTreeItems);
  }

  loadConnections(): void {
    const connectionIds = this._connectionController.getConnectionInstanceIds();
    this._connectionTreeItems = connectionIds.map(
      connectionId =>
        new ConnectionTreeItem(
          connectionId,
          connectionId ===
            this._connectionController.getActiveConnectionInstanceId(),
          this._connectionController
        )
    );

    if (
      this._connectionController.isConnnecting() &&
      this._connectionController
        .getConnectionInstanceIds()
        .indexOf(this._connectionController.getConnectingInstanceId()) === -1
    ) {
      const notYetEstablishConnectionTreeItem = new vscode.TreeItem(
        this._connectionController.getConnectingInstanceId()
      );

      notYetEstablishConnectionTreeItem.description = 'connecting...';

      // When we're connecting to a new connection we add simple node showing the connecting status.
      this._connectionTreeItems.push(notYetEstablishConnectionTreeItem);
    }
  }

  onDidCollapse(): void {
    this.isExpanded = false;
  }

  onDidExpand(): void {
    this.isExpanded = true;
  }
}
