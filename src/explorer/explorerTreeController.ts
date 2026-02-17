import * as vscode from 'vscode';

import type ConnectionController from '../connectionController';
import ConnectionTreeItem from './connectionTreeItem';
import type DatabaseTreeItem from './databaseTreeItem';
import { createLogger } from '../logging';
import { DOCUMENT_ITEM } from './documentTreeItem';
import { DOCUMENT_LIST_ITEM } from './documentListTreeItem';
import ExtensionCommand from '../commands';
import { sortTreeItemsByLabel } from './treeItemUtils';
import type { LoadedConnection } from '../storage/connectionStorage';
import {
  TreeItemExpandedTelemetryEvent,
  type TelemetryService,
} from '../telemetry';
import type TreeItemParentInterface from './treeItemParentInterface';
import { CollectionType } from './documentUtils';
import { PREVIEW_LIST_ITEM } from './documentPreviewItem';

const log = createLogger('explorer tree controller');

export default class ExplorerTreeController
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _connectionTreeItems: { [key: string]: ConnectionTreeItem };
  private _connectionController: ConnectionController;
  private _telemetryService: TelemetryService;

  constructor(
    connectionController: ConnectionController,
    telemetryService: TelemetryService,
  ) {
    this._connectionController = connectionController;
    this._telemetryService = telemetryService;

    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    // Subscribe to changes in the connections.
    this._connectionController.addEventListener(
      'CONNECTIONS_DID_CHANGE',
      () => {
        this.refresh();
      },
    );

    this._connectionTreeItems = {}; // No cache to start.
  }

  removeListeners(): void {
    this._connectionController.removeEventListener(
      'CONNECTIONS_DID_CHANGE',
      () => {
        this.refresh();
      },
    );
  }

  activateTreeViewEventHandlers = (
    treeView: vscode.TreeView<vscode.TreeItem>,
  ): void => {
    treeView.onDidCollapseElement((event) => {
      log.info('Tree item was collapsed', event.element.label);

      const treeItem = event.element as vscode.TreeItem &
        TreeItemParentInterface;
      if (treeItem.onDidCollapse) {
        treeItem.onDidCollapse();
      }

      if (
        'doesNotRequireTreeUpdate' in treeItem &&
        treeItem.doesNotRequireTreeUpdate
      ) {
        // When the element is already loaded (synchronous), we do not need to
        // fully refresh the tree.
        return;
      }

      this._onTreeItemUpdate();
    });

    treeView.onDidExpandElement(async (event): Promise<void> => {
      const treeItem = event.element as vscode.TreeItem &
        TreeItemParentInterface;
      this._telemetryService.track(
        new TreeItemExpandedTelemetryEvent(treeItem),
      );

      log.info('Explorer tree item was expanded', {
        type: treeItem.contextValue,
        connectionName: treeItem.label,
        isExpanded: treeItem.isExpanded,
      });

      if (!treeItem.onDidExpand) {
        return;
      }

      await treeItem.onDidExpand();

      if (
        'doesNotRequireTreeUpdate' in treeItem &&
        treeItem.doesNotRequireTreeUpdate
      ) {
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
            ExtensionCommand.mdbOpenMongodbDocumentFromTree,
            event.selection[0],
          );
        }

        if (
          selectedItem.contextValue === DOCUMENT_LIST_ITEM &&
          selectedItem.type === CollectionType.view
        ) {
          await vscode.commands.executeCommand(
            ExtensionCommand.mdbViewCollectionDocuments,
            event.selection[0],
          );
        }

        if (selectedItem.contextValue === PREVIEW_LIST_ITEM) {
          await vscode.commands.executeCommand(
            ExtensionCommand.mdbOpenCollectionPreviewFromTreeView,
            event.selection[0],
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

  /**
   * Finds the CollectionTreeItem for the given namespace in the active
   * connection's cache and resets it so the document count is re-fetched
   * on the next render.
   */
  resetCollectionCache(
    connectionId: string,
    databaseName: string,
    collectionName: string,
  ): void {
    const connectionItem = this._connectionTreeItems[connectionId];
    if (!connectionItem) {
      return;
    }

    const dbChildren = connectionItem.getChildrenCache();
    const dbItem = dbChildren[databaseName] as DatabaseTreeItem | undefined;
    if (!dbItem || !('getChildrenCache' in dbItem)) {
      return;
    }

    const collectionItem = dbItem.getChildrenCache()[collectionName];
    if (!collectionItem) {
      return;
    }

    collectionItem.resetCache();
  }

  private _onTreeItemUpdate(): void {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  private _getConnectionExpandedState(
    connection: LoadedConnection,
    pastConnectionTreeItems: {
      [key: string]: ConnectionTreeItem;
    },
  ): {
    collapsibleState: vscode.TreeItemCollapsibleState;
    isExpanded: boolean;
  } {
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
          this._getConnectionExpandedState(connection, pastConnectionTreeItems);

        this._connectionTreeItems[connection.id] = new ConnectionTreeItem({
          connectionId: connection.id,
          collapsibleState,
          isExpanded,
          source: connection.source ?? 'user',
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
        sortTreeItemsByLabel(Object.values(this._connectionTreeItems)),
      );
    }

    return element.getChildren();
  }
}
