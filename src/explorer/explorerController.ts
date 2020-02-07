import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import ExplorerDataProvider from './explorerTreeRoot';

export default class ConnectionExplorerController {
  // private _connectionTreeViewer?: vscode.TreeView<vscode.TreeItem>;
  private _treeDataProvider?: ExplorerDataProvider;

  public activate(connectionController: ConnectionController) {
    this._treeDataProvider = new ExplorerDataProvider(connectionController);

    // TODO: teardown?
    // this._connectionTreeViewer =
    vscode.window.createTreeView('mongoDB', {
      treeDataProvider: this._treeDataProvider
    });
  }

  public refresh(): Promise<boolean> {
    if (!this._treeDataProvider) {
      return Promise.reject('MongoDB service has not yet activated.');
    }

    this._treeDataProvider.refresh();

    return Promise.resolve(true);
  }
}
