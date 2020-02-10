
import * as vscode from 'vscode';

import ConnectionController, { DataServiceEventTypes } from '../connectionController';
import ConnectionTreeItem from './connectionTreeItem';
import DatabaseTreeItem from './databaseTreeItem';
import CollectionTreeItem from './collectionTreeItem';
import MDBConnectionsTreeItem from './mdbConnectionsTreeItem';

import { createLogger } from '../logging';

const log = createLogger('explorer controller');

export default class ExplorerTreeController implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _mdbConnectionsTreeItem: MDBConnectionsTreeItem;

  constructor(connectionController: ConnectionController) {
    this._mdbConnectionsTreeItem = new MDBConnectionsTreeItem(connectionController);

    this._onDidChangeTreeData = new vscode.EventEmitter<any>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    // Subscribe to changes in the connections.
    // TODO: Make sure we cleanup.
    connectionController.addConnectionEventListener(
      DataServiceEventTypes.connectionsDidChange,
      () => this.refresh()
    );
  }

  activateTreeViewEventHandlers = (treeView: vscode.TreeView<vscode.TreeItem>) => {
    treeView.onDidCollapseElement((event: any) => {
      log.info('Tree item was collapsed:', event.element.label);
      event.element.onDidCollapse();

      this.onTreeItemUpdate();
    });

    treeView.onDidExpandElement(async (event: any) => {
      log.info('Tree item was expanded:', event.element.label);
      await event.element.onDidExpand();

      this.onTreeItemUpdate();
    });

    treeView.onDidChangeSelection((event: any) => {
      if (event.selection && event.selection.length === 1) {
        if (event.selection[0].isShowMoreItem) {
          event.selection[0].onShowMoreClicked();
          this.onTreeItemUpdate();
        }
      }
    });
  }

  private _onDidChangeTreeData: vscode.EventEmitter<any>;
  readonly onDidChangeTreeData: vscode.Event<any>;

  public refresh() {
    this._mdbConnectionsTreeItem.loadConnections();
    this._onDidChangeTreeData.fire();
  }

  public onTreeItemUpdate() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MDBConnectionsTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MDBConnectionsTreeItem | ConnectionTreeItem | DatabaseTreeItem | CollectionTreeItem): Thenable<MDBConnectionsTreeItem[] | ConnectionTreeItem[] | DatabaseTreeItem[] | CollectionTreeItem[]> {
    if (!element) {
      // When element is present we are at the root.
      return Promise.resolve([
        this._mdbConnectionsTreeItem
      ]);
    } else {
      return element.getChildren();
    }
  }
}

