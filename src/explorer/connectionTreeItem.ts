import * as vscode from 'vscode';
import ns = require('mongodb-ns');
import path = require('path');

import DatabaseTreeItem from './databaseTreeItem';
import ConnectionController from '../connectionController';
import TreeItemParent from './treeItemParentInterface';
import { StatusView } from '../views';

enum ConnectionItemContextValues {
  disconnected = 'disconnectedConnectionTreeItem',
  connected = 'connectedConnectionTreeItem'
}
export { ConnectionItemContextValues };

export default class ConnectionTreeItem extends vscode.TreeItem
  connectionId(connectionId: any): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  implements TreeItemParent, vscode.TreeDataProvider<ConnectionTreeItem> {
  contextValue = ConnectionItemContextValues.disconnected;

  private _childrenCache: { [key: string]: DatabaseTreeItem };
  _childrenCacheIsUpToDate = false;

  private _connectionController: ConnectionController;
  connectionId: string;

  isExpanded: boolean;

  constructor(
    connectionId: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    isExpanded: boolean,
    connectionController: ConnectionController,
    existingChildrenCache: { [key: string]: DatabaseTreeItem }
  ) {
    super(
      connectionController.getSavedConnectionName(connectionId),
      collapsibleState
    );

    if (
      connectionController.getActiveConnectionId() === connectionId &&
      !connectionController.isDisconnecting() &&
      !connectionController.isConnecting()
    ) {
      this.contextValue = ConnectionItemContextValues.connected;
    }

    this.connectionId = connectionId;
    this._connectionController = connectionController;
    this.isExpanded = isExpanded;
    this._childrenCache = existingChildrenCache;

    // Create a unique id to ensure the tree updates the expanded property.
    // (Without an id it treats this tree item like a previous tree item with the same label).
    this.id = `${Date.now()}-${connectionId}`;
  }

  get tooltip(): string {
    return this._connectionController.getSavedConnectionName(this.connectionId);
  }

  get description(): string {
    if (
      this._connectionController.getActiveConnectionId() === this.connectionId
    ) {
      if (this._connectionController.isDisconnecting()) {
        return 'disconnecting...';
      }

      return 'connected';
    }

    if (
      this._connectionController.isConnecting() &&
      this._connectionController.getConnectingConnectionId() ===
      this.connectionId
    ) {
      return 'connecting...';
    }

    return '';
  }

  getTreeItem(element: ConnectionTreeItem): ConnectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (
      !this.isExpanded ||
      this._connectionController.isDisconnecting() ||
      this._connectionController.isConnecting()
    ) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(Object.values(this._childrenCache));
    }

    return new Promise((resolve, reject) => {
      const dataService = this._connectionController.getActiveDataService();
      if (dataService === null) {
        return reject(new Error('Not currently connected.'));
      }
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

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(__dirname, '..', '..', 'images', 'light');
    const DARK = path.join(__dirname, '..', '..', 'images', 'dark');

    if (
      this._connectionController.getActiveConnectionId() === this.connectionId
    ) {
      return {
        light: path.join(LIGHT, 'connection-active.svg'),
        dark: path.join(DARK, 'connection-active.svg')
      };
    }
    return {
      light: path.join(LIGHT, 'connection-inactive.svg'),
      dark: path.join(DARK, 'connection-inactive.svg')
    };
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;

    if (
      this._connectionController.getActiveConnectionId() === this.connectionId
    ) {
      return Promise.resolve(true);
    }

    // If we aren't the active connection, we reconnect.
    return new Promise((resolve) => {
      this._connectionController
        .connectWithConnectionId(this.connectionId)
        .then(
          () => resolve(true),
          (err) => {
            this.isExpanded = false;
            vscode.window.showErrorMessage(err);
            return resolve(false);
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

  async onAddDatabaseClicked(
    context: vscode.ExtensionContext
  ): Promise<boolean> {
    let databaseName;
    try {
      databaseName = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'e.g. myNewDB',
        prompt: 'Enter the new database name.',
        validateInput: (inputDatabaseName: string) => {
          if (
            inputDatabaseName &&
            inputDatabaseName.length > 0 &&
            !ns(inputDatabaseName).validDatabaseName
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
        placeHolder: 'e.g. myNewCollection',
        prompt:
          'Enter the new collection name. (A database must have a collection to be created.)',
        validateInput: (inputCollectionName: string) => {
          if (!inputCollectionName) {
            return null;
          }

          if (
            !ns(`${databaseName}.${inputCollectionName}`).validCollectionName
          ) {
            return 'MongoDB collection names cannot contain `/\\. "$` or the null character, and must be fewer than 64 characters';
          }

          if (ns(`${databaseName}.${inputCollectionName}`).system) {
            return 'MongoDB collection names cannot start with "system.". (Reserved for internal use.)';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.reject(
        new Error(`An error occured parsing the collection name: ${e}`)
      );
    }

    if (!collectionName) {
      return Promise.resolve(false);
    }

    const statusView = new StatusView(context);
    statusView.showMessage('Creating new database and collection...');

    return new Promise((resolve) => {
      const dataService = this._connectionController.getActiveDataService();
      if (dataService === null) {
        vscode.window.showErrorMessage(
          'Unable to create database, not currently connected.'
        );
        return Promise.resolve(false);
      }
      dataService.createCollection(
        `${databaseName}.${collectionName}`,
        {}, // No options.
        (err) => {
          statusView.hideMessage();

          if (err) {
            vscode.window.showErrorMessage(
              `Create collection failed: ${err.message}`
            );
            return resolve(false);
          }

          this._childrenCacheIsUpToDate = false;
          return resolve(true);
        }
      );
    });
  }
}
