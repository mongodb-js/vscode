import * as vscode from 'vscode';
const ns = require('mongodb-ns');
const path = require('path');

import DatabaseTreeItem from './databaseTreeItem';
import ConnectionController from '../connectionController';
import TreeItemParent from './treeItemParentInterface';
import { StatusView } from '../views';

enum ConnectionItemContextValues {
  disconnected = 'disconnectedConnectionTreeItem',
  connected = 'connectedConnectionTreeItem'
}

export default class ConnectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<ConnectionTreeItem> {
  contextValue = ConnectionItemContextValues.disconnected;

  private _childrenCache: { [key: string]: DatabaseTreeItem };
  _childrenCacheIsUpToDate = false;

  private _connectionController: ConnectionController;
  connectionInstanceId: string;

  isExpanded: boolean;

  constructor(
    connectionInstanceId: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    isExpanded: boolean,
    connectionController: ConnectionController,
    existingChildrenCache: { [key: string]: DatabaseTreeItem }
  ) {
    super(
      connectionInstanceId,
      collapsibleState
    );

    if (
      connectionController.getActiveConnectionInstanceId() === connectionInstanceId
      && !connectionController.isDisconnecting()
      && !connectionController.isConnecting()
    ) {
      this.contextValue = ConnectionItemContextValues.connected;
    }

    this.connectionInstanceId = connectionInstanceId;
    this._connectionController = connectionController;
    this.isExpanded = isExpanded;
    this._childrenCache = existingChildrenCache;

    // Create a unique id to ensure the tree updates the expanded property.
    // (Without an id it treats this tree item like a previous tree item with the same label).
    this.id = `${Date.now()}-${connectionInstanceId}`;
  }

  get tooltip(): string {
    return this.connectionInstanceId;
  }

  get description(): string {
    if (
      this._connectionController.getActiveConnectionInstanceId() ===
      this.connectionInstanceId
    ) {
      if (this._connectionController.isDisconnecting()) {
        return 'disconnecting...';
      }

      return 'connected';
    }

    if (this._connectionController.isConnecting()
      && this._connectionController.getConnectingInstanceId() === this.connectionInstanceId
    ) {
      return 'connecting...';
    }

    return '';
  }

  getTreeItem(element: ConnectionTreeItem): ConnectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.isExpanded
      || this._connectionController.isDisconnecting()
      || this._connectionController.isConnecting()
    ) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(Object.values(this._childrenCache));
    }

    return new Promise((resolve, reject) => {
      const dataService = this._connectionController.getActiveConnection();
      dataService.listDatabases((err: any, databases: string[]) => {
        if (err) {
          return reject(new Error(`Unable to list databases: ${err.message}`));
        }

        this._childrenCacheIsUpToDate = true;

        if (databases) {
          const pastChildrenCache = this._childrenCache;
          this._childrenCache = {};

          databases.forEach(({ name }: any) => {
            if (pastChildrenCache[name]) {
              // We create a new element here instead of reusing the cached one
              // in order to ensure the expanded state is set.
              this._childrenCache[name] = new DatabaseTreeItem(
                name,
                dataService,
                pastChildrenCache[name].isExpanded,
                pastChildrenCache[name].getChildrenCache()
              );
            } else {
              this._childrenCache[name] = new DatabaseTreeItem(
                name,
                dataService,
                false, // Collapsed.
                {} // No existing cache.
              );
            }
          });
        } else {
          this._childrenCache = {};
        }

        return resolve(Object.values(this._childrenCache));
      });
    });
  }

  get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    return this._connectionController.getActiveConnectionInstanceId() === this.connectionInstanceId
      ? {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'active-connection.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'active-connection.svg')
      }
      : {
        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'inactive-connection.svg'),
        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'inactive-connection.svg')
      };
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;

    if (this._connectionController.getActiveConnectionInstanceId() === this.connectionInstanceId) {
      return Promise.resolve(true);
    }

    // If we aren't the active connection, we reconnect.
    return new Promise(resolve => {
      this._connectionController.connectWithInstanceId(this.connectionInstanceId).then(
        () => resolve(true),
        err => {
          this.isExpanded = false;
          vscode.window.showErrorMessage(err);
          resolve(false);
        }
      );
    });
  }

  resetCache(): void {
    this._childrenCache = {};
    this._childrenCacheIsUpToDate = false;
  }

  getChildrenCache(): { [key: string]: DatabaseTreeItem } {
    return this._childrenCache;
  }

  async onAddDatabaseClicked(context: vscode.ExtensionContext): Promise<boolean> {
    let databaseName;
    try {
      databaseName = await vscode.window.showInputBox({
        value: '',
        placeHolder:
          'e.g. myNewDB',
        prompt: 'Enter the new database name.',
        validateInput: (inputDatabaseName: any) => {
          if (
            inputDatabaseName
            && inputDatabaseName.length > 0
            && !ns(inputDatabaseName).validDatabaseName
          ) {
            return 'MongoDB database names cannot contain `/\\. "$` or the null character, and must be fewer than 64 characters';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.reject(
        new Error(`An error occured parsing the database name: ${e}`)
      );
    }

    if (!databaseName) {
      return Promise.resolve(false);
    }

    let collectionName;
    try {
      collectionName = await vscode.window.showInputBox({
        value: '',
        placeHolder:
          'e.g. myNewCollection',
        prompt: 'Enter the new collection name. (A database must have a collection to be created.)',
        validateInput: (inputCollectionName: any) => {
          if (!inputCollectionName) {
            return null;
          }

          if (!ns(`${databaseName}.${inputCollectionName}`).validCollectionName) {
            return 'MongoDB collection names cannot contain `/\\. "$` or the null character, and must be fewer than 64 characters';
          }

          if (ns(`${databaseName}.${inputCollectionName}`).system) {
            return 'MongoDB collection names cannot start with "system.". (Reserved for internal use.)';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.reject(new Error(
        `An error occured parsing the collection name: ${e}`
      ));
    }

    if (!collectionName) {
      return Promise.resolve(false);
    }

    const statusView = new StatusView(context);
    statusView.showMessage('Creating new database and collection...');

    return new Promise(resolve => {
      this._connectionController.getActiveConnection().createCollection(
        `${databaseName}.${collectionName}`,
        {}, // No options.
        (err) => {
          statusView.hideMessage();

          if (err) {
            vscode.window.showErrorMessage(`Create collection failed: ${err.message}`);
            return resolve(false);
          }

          this._childrenCacheIsUpToDate = false;
          return resolve(true);
        }
      );
    });
  }
}
