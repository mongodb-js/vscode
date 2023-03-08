import * as vscode from 'vscode';
import NotebooksTree from './notebooksTree';

export default class NotebooksExplorer {
  private _treeController: NotebooksTree;
  private _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor() {
    this._treeController = new NotebooksTree();
  }

  private createNotebooksTreeView = (): void => {
    if (!this._treeView) {
      this._treeView = vscode.window.createTreeView(
        'mongoDBNotebooksExplorer',
        {
          treeDataProvider: this._treeController,
        }
      );
      this._treeController.activateTreeViewEventHandlers(this._treeView);
    }
  };

  public activateNotebooksTreeView(): void {
    this.createNotebooksTreeView();
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

  public getTreeController(): NotebooksTree {
    return this._treeController;
  }
}
