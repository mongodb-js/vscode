import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import ExplorerDataProvider from './explorerTreeRoot';

export default class ConnectionExplorerController {
  private connectionTreeViewer?: vscode.TreeView<vscode.TreeItem>;

  activate(connectionController: ConnectionController) {
    const treeDataProvider = new ExplorerDataProvider(connectionController);

    this.connectionTreeViewer = vscode.window.createTreeView('mongoDB', { treeDataProvider });
  }
}
