import * as vscode from 'vscode';
import ConnectionController, {
  DataServiceEventTypes
} from '../connectionController';
import { DOCUMENT_ITEM } from './documentTreeItem';
import { createLogger } from '../logging';
import { DOCUMENT_LIST_ITEM, CollectionTypes } from './documentListTreeItem';
import ConnectionTreeItem from './connectionTreeItem';
import { SavedConnection } from '../storage/storageController';
import { sortTreeItemsByLabel } from './treeItemUtils';

const log = createLogger('explorer controller');

export default class ExplorerTreeController
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _connectionController: ConnectionController;
  private _connectionTreeItems: { [key: string]: ConnectionTreeItem };
  contextValue = 'explorerTreeController';

  constructor(connectionController: ConnectionController) {
    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._connectionController = connectionController;

    // Subscribe to changes in the connections.
    this._connectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      this.refresh
    );

    this._connectionTreeItems = {}; // No cache to start.
  }

  removeListeners(): void {
    this._connectionController.removeEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      this.refresh
    );
  }

  activateTreeViewEventHandlers = (
    treeView: vscode.TreeView<vscode.TreeItem>
  ): void => {
    treeView.onDidCollapseElement((event: any) => {
      log.info('Tree item was collapsed:', event.element.label);

      if (event.element.onDidCollapse) {
        event.element.onDidCollapse();
      }

      if (event.element.doesNotRequireTreeUpdate) {
        // When the element is already loaded (synchronous), we do not need to
        // fully refresh the tree.
        return;
      }

      this.onTreeItemUpdate();
    });

    treeView.onDidExpandElement(
      (event: any): Promise<void> => {
        log.info('Tree item was expanded:', event.element.label);

        return new Promise((resolve, reject) => {
          if (!event.element.onDidExpand) {
            return resolve();
          }

          event.element.onDidExpand().then(
            () => {
              if (event.element.doesNotRequireTreeUpdate) {
                // When the element is already loaded (synchronous), we do not
                // need to fully refresh the tree.
                return resolve();
              }

              this.onTreeItemUpdate();

              resolve();
            },
            (err: Error) => {
              reject(err);
            }
          );
        });
      }
    );

    treeView.onDidChangeSelection((event: any) => {
      if (event.selection && event.selection.length === 1) {
        const selectedItem = event.selection[0];

        if (selectedItem.isShowMoreItem) {
          selectedItem.onShowMoreClicked();

          this.onTreeItemUpdate();
        }

        if (selectedItem.contextValue === DOCUMENT_ITEM) {
          vscode.commands.executeCommand(
            'mdb.viewDocument',
            event.selection[0]
          );
        }

        if (
          selectedItem.contextValue === DOCUMENT_LIST_ITEM &&
          selectedItem.type === CollectionTypes.view
        ) {
          vscode.commands.executeCommand(
            'mdb.viewCollectionDocuments',
            event.selection[0]
          );
        }
      }
    });
  };

  private _onDidChangeTreeData: vscode.EventEmitter<any>;
  readonly onDidChangeTreeData: vscode.Event<any>;

  public refresh = (): Promise<boolean> => {
    this._onDidChangeTreeData.fire();

    return Promise.resolve(true);
  };

  public onTreeItemUpdate(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: any): Thenable<any[]> {
    // When no element is present we are at the root.
    if (!element) {
      const connections = this._connectionController.getSavedConnections();
      const pastConnectionTreeItems = this._connectionTreeItems;
      this._connectionTreeItems = {};

      // Create new connection tree items, using cached children wherever possible.
      connections.forEach((connection: SavedConnection) => {
        const isActiveConnection =
          connection.id === this._connectionController.getActiveConnectionId();
        const isBeingConnectedTo =
          this._connectionController.isConnecting() &&
          connection.id ===
            this._connectionController.getConnectingConnectionId();

        let connectionExpandedState = isActiveConnection
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed;

        if (
          pastConnectionTreeItems[connection.id] &&
          !pastConnectionTreeItems[connection.id].isExpanded
        ) {
          // Connection was manually collapsed while being active.
          connectionExpandedState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        if (
          isActiveConnection &&
          this._connectionController.isDisconnecting()
        ) {
          // Don't show a collapsable state when the connection is being disconnected from.
          connectionExpandedState = vscode.TreeItemCollapsibleState.None;
        }
        if (isBeingConnectedTo) {
          // Don't show a collapsable state when the connection is being connected to.
          connectionExpandedState = vscode.TreeItemCollapsibleState.None;
        }

        this._connectionTreeItems[connection.id] = new ConnectionTreeItem(
          connection.id,
          connectionExpandedState,
          isActiveConnection,
          this._connectionController,
          pastConnectionTreeItems[connection.id]
            ? pastConnectionTreeItems[connection.id].cacheIsUpToDate
            : false,
          pastConnectionTreeItems[connection.id]
            ? pastConnectionTreeItems[connection.id].getChildrenCache()
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

    return element.getChildren();
  }
}
