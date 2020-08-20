import * as vscode from 'vscode';
import ConnectionController, {
  DataServiceEventTypes
} from '../connectionController';
import { DOCUMENT_ITEM } from './documentTreeItem';
import MDBConnectionsTreeItem from './mdbConnectionsTreeItem';
import { createLogger } from '../logging';
import { DOCUMENT_LIST_ITEM, CollectionTypes } from './documentListTreeItem';

const log = createLogger('explorer controller');

export default class ExplorerTreeController
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _connectionController: ConnectionController;
  private _mdbConnectionsTreeItem: MDBConnectionsTreeItem;

  constructor(connectionController: ConnectionController) {
    this._mdbConnectionsTreeItem = new MDBConnectionsTreeItem(
      connectionController,
      {} // No cache to start.
    );
    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._connectionController = connectionController;

    // Subscribe to changes in the connections.
    this._connectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      this.refresh
    );
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
    this._mdbConnectionsTreeItem.connectionsDidChange();
    this._onDidChangeTreeData.fire();

    return Promise.resolve(true);
  };

  public onTreeItemUpdate(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MDBConnectionsTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: any): Thenable<any[]> {
    // When no element is present we are at the root.
    if (!element) {
      // We rebuild the connections tree each time in order to
      // manually control the expanded state of tree items.
      this._mdbConnectionsTreeItem = new MDBConnectionsTreeItem(
        this._connectionController,
        this._mdbConnectionsTreeItem.getConnectionItemsCache()
      );

      return Promise.resolve([this._mdbConnectionsTreeItem]);
    }

    return element.getChildren();
  }
}
