import * as vscode from 'vscode';

import ConnectionController, {
  DataServiceEventTypes
} from '../connectionController';
import ConnectionTreeItem from './connectionTreeItem';
import DatabaseTreeItem from './databaseTreeItem';
import CollectionTreeItem from './collectionTreeItem';
import MDBConnectionsTreeItem from './mdbConnectionsTreeItem';

import { createLogger } from '../logging';

const log = createLogger('explorer controller');

export default class ExplorerTreeController implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _connectionController: ConnectionController;
  private _mdbConnectionsTreeItem: MDBConnectionsTreeItem;

  constructor(connectionController: ConnectionController) {
    this._mdbConnectionsTreeItem = new MDBConnectionsTreeItem(
      connectionController
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
      event.element.onDidCollapse();

      this.onTreeItemUpdate();
    });

    treeView.onDidExpandElement((event: any): Promise<any> => {
      log.info('Tree item was expanded:', event.element.label);
      return new Promise((resolve, reject) => {
        event.element.onDidExpand().then(() => {
          this.onTreeItemUpdate();
          resolve(true);
        }, (err: Error) => {
          reject(err);
        });
      });
    });

    treeView.onDidChangeSelection((event: any) => {
      if (event.selection && event.selection.length === 1) {
        if (event.selection[0].isShowMoreItem) {
          event.selection[0].onShowMoreClicked();
          this.onTreeItemUpdate();
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

  getChildren(
    element?:
      | MDBConnectionsTreeItem
      | ConnectionTreeItem
      | DatabaseTreeItem
      | CollectionTreeItem
  ): Thenable<
    | MDBConnectionsTreeItem[]
    | ConnectionTreeItem[]
    | DatabaseTreeItem[]
    | CollectionTreeItem[]
  > {
    if (!element) {
      // When element is present we are at the root.
      return Promise.resolve([this._mdbConnectionsTreeItem]);
    }

    return element.getChildren();
  }
}
