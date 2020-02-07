
import * as vscode from 'vscode';

import ConnectionController, { DataServiceEventTypes } from '../connectionController';
import MongoDBConnectionTreeItem from './mongoDBConnectionTreeItem';
import MongoDBDatabaseTreeItem from './mongoDBDatabaseTreeItem';
import MongoDBCollectionTreeItem from './mongoDBCollectionTreeItem';

export default class ExplorerTreeRootController implements vscode.TreeDataProvider<vscode.TreeItem> {
  _rootTreeItem: ExplorerRootTreeItem;

  constructor(connectionController: ConnectionController) {
    this._rootTreeItem = new ExplorerRootTreeItem(connectionController);

    this._onDidChangeTreeData = new vscode.EventEmitter<any>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    // Subscribe to changes in the connections.
    // TODO: Make sure we cleanup.
    connectionController.addEventListener(
      DataServiceEventTypes.connectionsDidChange,
      () => this.refresh()
    );
  }

  private _onDidChangeTreeData: vscode.EventEmitter<any>;
  readonly onDidChangeTreeData: vscode.Event<any>;

  public refresh() {
    console.log('Refresh explorer tree called.');
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ExplorerRootTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ExplorerRootTreeItem | MongoDBConnectionTreeItem | MongoDBDatabaseTreeItem | MongoDBCollectionTreeItem): Thenable<ExplorerRootTreeItem[] | MongoDBConnectionTreeItem[] | MongoDBDatabaseTreeItem[] | MongoDBCollectionTreeItem[]> {
    if (!element) {
      return Promise.resolve([
        this._rootTreeItem
      ]);
    } else {
      return element.getChildren();
    }
  }
}

const rootLabel = 'Connections';
const rootTooltip = 'Your MongoDB connections';

export class ExplorerRootTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _connectionController: ConnectionController;

  constructor(connectionController: ConnectionController) {
    super(rootLabel, vscode.TreeItemCollapsibleState.Expanded);

    this._connectionController = connectionController;
  }

  get tooltip(): string {
    return rootTooltip;
  }

  get description(): string {
    return '';
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    console.log('Get tree item!');
    return element;
  }

  getChildren(): Thenable<MongoDBConnectionTreeItem[]> {
    console.log('Get children of root item.');

    const connectionIds = this._connectionController.getConnectionInstanceIds();
    const connectionTreeItems = connectionIds.map(
      connectionId => new MongoDBConnectionTreeItem(
        connectionId,
        connectionId === this._connectionController.getActiveConnectionInstanceId(),
        this._connectionController.getActiveConnection()
      )
    );

    return Promise.resolve(connectionTreeItems);
  }
}
