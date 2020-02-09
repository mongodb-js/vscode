import * as vscode from 'vscode';

import MongoDBDatabaseTreeItem from './mongoDBDatabaseTreeItem';
import ConnectionController from '../connectionController';
import TreeItemParent from './treeItemParent';

export default class MongoDBConnectionTreeItem extends vscode.TreeItem implements TreeItemParent, vscode.TreeDataProvider<MongoDBConnectionTreeItem> {
  private _childrenCache: MongoDBDatabaseTreeItem[] = [];
  private _childrenCacheIsUpToDate: boolean = false;
  // private _dataService: any;
  private _connectionController: ConnectionController;
  private _connectionInstanceId: string;

  isExpanded: boolean;

  constructor(
    connectionInstanceId: string,
    isActiveConnection: boolean,
    connectionController: ConnectionController
  ) {
    super(
      connectionInstanceId,
      isActiveConnection ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
    );

    this._connectionInstanceId = connectionInstanceId;
    this._connectionController = connectionController;
    this.isExpanded = isActiveConnection;

    // Create a unique id to ensure the tree updates the expanded property.
    // (Without an id it treats this tree item like a previous tree item with the same label).
    this.id = `${Date.now()}-${connectionInstanceId}`;
  }

  get tooltip(): string {
    return this._connectionInstanceId;
  }

  get description(): string {
    return this._connectionController.getActiveConnectionInstanceId() === this._connectionInstanceId ? 'connected' : '';
  }

  getTreeItem(element: MongoDBConnectionTreeItem): MongoDBConnectionTreeItem {
    console.log('Get connection tree item');
    return element;
  }

  // TODO: Get a slightly stricter type than any.
  getChildren(): Thenable<any[]> {
    console.log('Get connection tree item children is exp', this.isExpanded, 'is cache up to date', this._childrenCacheIsUpToDate);

    if (this.isExpanded) {
      if (this._childrenCacheIsUpToDate) {
        return Promise.resolve(this._childrenCache);
      } else {
        // TODO: Version cache requests.
        return new Promise(async (resolve, reject) => {
          const dataService = this._connectionController.getActiveConnection();
          // If we aren't the active connection, we reconnect.
          if (this._connectionController.getActiveConnectionInstanceId() !== this._connectionInstanceId) {
            if (this._connectionController.getActiveConnectionInstanceId() !== this._connectionInstanceId) {
              try {
                await this._connectionController.connectWithInstanceId(this._connectionInstanceId);
              } catch (err) {
                reject(err);
              }
            }
          }
          dataService.listDatabases((err: any, databases: string[]) => {
            this._childrenCacheIsUpToDate = true;

            // console.log('got databases', databases);
            if (err) {
              // TODO: Error here properly.
              this._childrenCache = [];
              return resolve([]);
            }

            if (databases) {
              this._childrenCache = databases.map(
                ({ name }: any) => new MongoDBDatabaseTreeItem(name, dataService)
              );
            } else {
              this._childrenCache = [];
            }

            return resolve(this._childrenCache);
          });
        });
      }
    }

    // Here we either want to return loading or nothing.
    return Promise.resolve([]);
  }

  onDidCollapse() {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  async onDidExpand() {
    console.log('expand connection', this._connectionInstanceId);
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}
