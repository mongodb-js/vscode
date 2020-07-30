import * as vscode from 'vscode';

import ConnectionController, {
  DataServiceEventTypes
} from '../connectionController';
import ExplorerTreeController from './explorerTreeController';

import { createLogger } from '../logging';

const log = createLogger('explorer controller');

export default class ExplorerController {
  private _connectionController: ConnectionController;
  private _treeController: ExplorerTreeController;
  private _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor(connectionController: ConnectionController) {
    log.info('activate explorer controller');

    this._connectionController = connectionController;
    this._treeController = new ExplorerTreeController(connectionController);
  }

  createTreeView = (): void => {
    // Remove the listener that called this function.
    this._connectionController.removeEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      this.createTreeView
    );

    if (!this._treeView) {
      this._treeView = vscode.window.createTreeView('mongoDBConnectionExplorer', {
        treeDataProvider: this._treeController
      });
      this._treeController.activateTreeViewEventHandlers(this._treeView);
    }
  };

  activateTreeView(): void {
    // Listen for a change in connections to occur before we create the tree
    // so that we show the `viewsWelcome` before any connections are added.
    this._connectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      this.createTreeView
    );
  }

  deactivate(): void {
    if (this._treeController) {
      this._treeController.removeListeners();
    }

    if (this._treeView) {
      this._treeView.dispose();
      delete this._treeView;
    }
  }

  refresh(): Promise<boolean> {
    if (this._treeController) {
      return this._treeController.refresh();
    }

    return Promise.reject(new Error('No tree to refresh.'));
  }

  // Exposed for testing.
  public getTreeView(): vscode.TreeView<vscode.TreeItem> | undefined {
    return this._treeView;
  }

  public getTreeController(): ExplorerTreeController {
    return this._treeController;
  }
}
