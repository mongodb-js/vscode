import * as vscode from 'vscode';

import type ConnectionController from '../connectionController';
import { DataServiceEventTypes } from '../connectionController';
import ConnectionTreeItem from './connectionTreeItem';
import { createLogger } from '../logging';
import { DOCUMENT_ITEM } from './documentTreeItem';
import { DOCUMENT_LIST_ITEM, CollectionTypes } from './documentListTreeItem';
import EXTENSION_COMMANDS from '../commands';
import { sortTreeItemsByLabel } from './treeItemUtils';
import type { LoadedConnection } from '../storage/connectionStorage';

const log = createLogger('explorer tree controller');

export default class ExplorerTreeController
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _connectionController: ConnectionController;
  private _connectionTreeItems: { [key: string]: ConnectionTreeItem };

  constructor(connectionController: ConnectionController) {
    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._connectionController = connectionController;

    // Subscribe to changes in the connections.
    this._connectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        this.refresh();
      }
    );

    this._connectionTreeItems = {}; // No cache to start.
  }

  removeListeners(): void {
    this._connectionController.removeEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        this.refresh();
      }
    );
  }

  activateTreeViewEventHandlers = (
    treeView: vscode.TreeView<vscode.TreeItem>
  ): void => {
    treeView.onDidCollapseElement((event: any) => {
      log.info('Tree item was collapsed', event.element.label);

      if (event.element.onDidCollapse) {
        event.element.onDidCollapse();
      }

      if (event.element.doesNotRequireTreeUpdate) {
        // When the element is already loaded (synchronous), we do not need to
        // fully refresh the tree.
        return;
      }

      this._onTreeItemUpdate();
    });

    treeView.onDidExpandElement(async (event: any): Promise<void> => {
      log.info('Connection tree item was expanded', {
        connectionId: event.element.connectionId,
        connectionName: event.element.label,
        isExpanded: event.element.isExpanded,
      });

      if (!event.element.onDidExpand) {
        return;
      }

      await event.element.onDidExpand();

      if (event.element.doesNotRequireTreeUpdate) {
        // When the element is already loaded (synchronous), we do not
        // need to fully refresh the tree.
        return;
      }

      this._onTreeItemUpdate();
    });

    treeView.onDidChangeSelection(async (event: any) => {
      if (event.selection && event.selection.length === 1) {
        const selectedItem = event.selection[0];

        if (selectedItem.isShowMoreItem) {
          selectedItem.onShowMoreClicked();

          this._onTreeItemUpdate();
        }

        if (selectedItem.contextValue === DOCUMENT_ITEM) {
          await vscode.commands.executeCommand(
            EXTENSION_COMMANDS.MDB_OPEN_MONGODB_DOCUMENT_FROM_TREE,
            event.selection[0]
          );
        }

        if (
          selectedItem.contextValue === DOCUMENT_LIST_ITEM &&
          selectedItem.type === CollectionTypes.view
        ) {
          await vscode.commands.executeCommand(
            EXTENSION_COMMANDS.MDB_VIEW_COLLECTION_DOCUMENTS,
            event.selection[0]
          );
        }
      }
    });
  };

  _onDidChangeTreeData: vscode.EventEmitter<any>;
  readonly onDidChangeTreeData: vscode.Event<any>;

  refresh = (): boolean => {
    this._onDidChangeTreeData.fire(null);

    return true;
  };

  private _onTreeItemUpdate(): void {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  private _getConnectionExpandedState(connection: LoadedConnection): {
    collapsibleState: vscode.TreeItemCollapsibleState;
    isExpanded: boolean;
  } {
    const pastConnectionTreeItems = this._connectionTreeItems;
    const isActiveConnection =
      connection.id === this._connectionController.getActiveConnectionId();
    const isBeingConnectedTo =
      this._connectionController.isConnecting() &&
      connection.id === this._connectionController.getConnectingConnectionId();

    let collapsibleState = isActiveConnection
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;

    if (
      pastConnectionTreeItems[connection.id] &&
      !pastConnectionTreeItems[connection.id].isExpanded
    ) {
      // Connection was manually collapsed while being active.
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
    if (isActiveConnection && this._connectionController.isDisconnecting()) {
      // Don't show a collapsable state when the connection is being disconnected from.
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
    if (isBeingConnectedTo) {
      // Don't show a collapsable state when the connection is being connected to.
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
    return {
      collapsibleState,
      // Set expanded when we're connecting to a connection so that it
      // expands when it's connected.
      isExpanded:
        isBeingConnectedTo ||
        collapsibleState === vscode.TreeItemCollapsibleState.Expanded,
    };
  }

  getChildren(element?: any): Thenable<any[]> {
    // When no element is present we are at the root.
    if (!element) {
      const connections = this._connectionController.getSavedConnections();
      const pastConnectionTreeItems = this._connectionTreeItems;
      this._connectionTreeItems = {};

      // Create new connection tree items, using cached children wherever possible.
      connections.forEach((connection) => {
        const { collapsibleState, isExpanded } =
          this._getConnectionExpandedState(connection);

        this._connectionTreeItems[connection.id] = new ConnectionTreeItem({
          connectionId: connection.id,
          collapsibleState,
          isExpanded,
          isMutable: connection.isMutable ?? true,
          connectionController: this._connectionController,
          cacheIsUpToDate: pastConnectionTreeItems[connection.id]
            ? pastConnectionTreeItems[connection.id].cacheIsUpToDate
            : false,
          childrenCache: pastConnectionTreeItems[connection.id]
            ? pastConnectionTreeItems[connection.id].getChildrenCache()
            : {},
        });
      });

      return Promise.resolve(
        sortTreeItemsByLabel(Object.values(this._connectionTreeItems))
      );
    }

    return element.getChildren();
  }
}
