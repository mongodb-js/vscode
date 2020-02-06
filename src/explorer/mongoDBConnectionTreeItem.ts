import * as vscode from 'vscode';

import MongoDBDatabaseTreeItem from './mongoDBDatabaseTreeItem';
// import ConnectionController from '../connectionController';

export default class MongoDBConnectionTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBConnectionTreeItem> {
  connectionInstanceId: string;
  isActiveConnection: boolean;
  _dataService: any;

  constructor(
    connectionInstanceId: string,
    isActiveConnection: boolean,
    dataService: any
  ) {
    super(
      connectionInstanceId,
      isActiveConnection ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.connectionInstanceId = connectionInstanceId;
    this.isActiveConnection = isActiveConnection;
    this._dataService = dataService;

    console.log('created tree item.');
  }

  get tooltip(): string {
    return this.connectionInstanceId;
  }

  get description(): string {
    return this.isActiveConnection ? 'connected' : '';
  }

  getTreeItem(element: MongoDBConnectionTreeItem): MongoDBConnectionTreeItem {
    console.log('Get connection tree item');
    return element;
  }

  // TODO: Get a slightly stricter type than any.
  getChildren(element?: MongoDBConnectionTreeItem): Thenable<any[]> {
    console.log('Get connection tree item children');

    // if (this.connectionInstanceId) {
    // if (this.isActiveConnection) {
    console.log('element', element);
    console.log('this.isActiveConnectio', this.isActiveConnection);
    console.log('this.connectionInstanceId', this.connectionInstanceId);
    if (this.isActiveConnection) {
      return new Promise((resolve, reject) => {
        console.log('about to list databases');
        this._dataService.listDatabases((err: any, databases: string[]) => {
          console.log('got databases', databases);
          if (err) {
            // TODO: Error here properly
            return resolve([]);
          }

          if (databases) {
            return resolve(databases.map(({ name }: any) => new MongoDBDatabaseTreeItem(name)));
          }

          return resolve([]);
        });
      });
    }

    // Here we either want to return loading or nothing.
    return Promise.resolve([]);
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}
