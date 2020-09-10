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

  private createPlaygroundsTreeView = (): void => {
    if (!this._treeView) {
      this._treeView = vscode.window.createTreeView(
        'mongoDBPlaygroundsExplorer',
        {
          treeDataProvider: this._treeController
        }
      );
      this._treeController.activateTreeViewEventHandlers(this._treeView);
    }
  };

  public activatePlaygroundsTreeView(): void {
    this.createPlaygroundsTreeView();
  }

  public deactivate(): void {
    if (this._treeView) {
      this._treeView.dispose();
      delete this._treeView;
    }
  }

  public refresh(): Promise<boolean> {
    if (this._treeController) {
      return this._treeController.refresh();
    }

    return Promise.reject(new Error('No tree to refresh.'));
  }

  public getTreeController(): PlaygroundsTree {
    return this._treeController;
  }
}
