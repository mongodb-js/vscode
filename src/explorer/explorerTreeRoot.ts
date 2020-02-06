
import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import MongoDBConnectionTreeItem from './mongoDBConnectionTreeItem';
// import MongoDBDatabaseTreeItem from './mongoDBDatabaseTreeItem';

export default class ExplorerTreeRootController implements vscode.TreeDataProvider<vscode.TreeItem> {
  _rootTreeItem: ExplorerRootTreeItem;

  constructor(connectionController: ConnectionController) {
    this._rootTreeItem = new ExplorerRootTreeItem(connectionController);
  }

  getTreeItem(element: ExplorerRootTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ExplorerRootTreeItem | MongoDBConnectionTreeItem): Thenable<ExplorerRootTreeItem[] | MongoDBConnectionTreeItem[]> {
    // TODO: Get the data from our active connection if we don't have it yet.

    if (!element) {
      return Promise.resolve([
        this._rootTreeItem
      ]);
      // return [this._rootTreeItem];
    } else {
      return element.getChildren();
    }

    // return Promise.resolve([]);
  }
}

const rootLabel = 'Connections';

export class ExplorerRootTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBConnectionTreeItem> {
  _connectionController: ConnectionController;

  constructor(connectionController: ConnectionController) {
    super(rootLabel, vscode.TreeItemCollapsibleState.Expanded);

    this._connectionController = connectionController;
  }

  get tooltip(): string {
    return rootLabel;
  }

  get description(): string {
    return '';
  }

  getTreeItem(element: MongoDBConnectionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<MongoDBConnectionTreeItem[]> {
    // new MongoDBConnectionTreeItem('mock connection 1');
    // new MongoDBConnectionTreeItem('mock connection 2');

    // return Promise.resolve(mockConnectionsA);
    const connectionIds = this._connectionController.getConnectionInstanceIds();
    const connectionTreeItems = connectionIds.map(
      connection => new MongoDBConnectionTreeItem(connection)
    );

    return Promise.resolve(connectionTreeItems);
  }

  // getChildren(element: { key: string }): { key: string }[] {
  //   return Object.keys(mockConnections);
  // }
}
