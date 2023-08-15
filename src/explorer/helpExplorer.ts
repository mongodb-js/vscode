import * as vscode from 'vscode';
import HelpTree from './helpTree';
import type { TelemetryService } from '../telemetry';

export default class HelpExplorer {
  _treeController: HelpTree;
  _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor() {
    this._treeController = new HelpTree();
  }

  activateHelpTreeView(telemetryService: TelemetryService): void {
    if (!this._treeView) {
      this._treeView = vscode.window.createTreeView('mongoDBHelpExplorer', {
        treeDataProvider: this._treeController,
      });
      this._treeController.activateTreeViewEventHandlers(
        this._treeView,
        telemetryService
      );
    }
  }

  deactivate(): void {
    if (this._treeView) {
      this._treeView.dispose();
      delete this._treeView;
    }
  }
}
