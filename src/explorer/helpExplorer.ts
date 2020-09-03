import * as vscode from 'vscode';
import HelpTree from './helpTree';
import { createLogger } from '../logging';

const log = createLogger('help and info explorer controller');

export default class HelpExplorer {
  private _treeController: HelpTree;
  private _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor() {
    log.info('activate help explorer');
    this._treeController = new HelpTree();
  }

  public activateHelpTreeView(): void {
    if (!this._treeView) {
      this._treeView = vscode.window.createTreeView(
        'mongoDBHelpExplorer',
        {
          treeDataProvider: this._treeController
        }
      );
      this._treeController.activateTreeViewEventHandlers(this._treeView);
    }
  }

  public deactivate(): void {
    if (this._treeView) {
      this._treeView.dispose();
      delete this._treeView;
    }
  }

  public getTreeController(): HelpTree {
    return this._treeController;
  }
}
