import * as vscode from 'vscode';
import PlaygroundsTree from './playgroundsTree';
import { createLogger } from '../logging';

const log = createLogger('explorer controller');

export default class PlaygroundsExplorer {
  private _treeController: PlaygroundsTree;
  private _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor() {
    log.info('activate playgrounds explorer');
    this._treeController = new PlaygroundsTree();
  }

  createPlaygroundsTreeView = (): void => {
    if (!this._treeView) {
      this._treeView = vscode.window.createTreeView('mongoDBPlaygrounds', {
        treeDataProvider: this._treeController
      });
      this._treeController.activateTreeViewEventHandlers(this._treeView);
    }
  };

  async activatePlaygroundsTreeView(): Promise<void> {
    this.createPlaygroundsTreeView();
  }

  deactivate(): void {
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
  public getPlaygroundsTreeView():
    | vscode.TreeView<vscode.TreeItem>
    | undefined {
    return this._treeView;
  }

  public getTreeController(): PlaygroundsTree {
    return this._treeController;
  }
}
