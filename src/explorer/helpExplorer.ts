import type * as vscode from 'vscode';
import HelpTree from './helpTree';
import type { TelemetryService } from '../telemetry';
import { createTrackedTreeView } from '../utils/treeViewHelper';

export default class HelpExplorer {
  _treeController: HelpTree;
  _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor(private _telemetryService: TelemetryService) {
    this._treeController = new HelpTree();
  }

  activateHelpTreeView(): void {
    if (!this._treeView) {
      this._treeView = createTrackedTreeView(
        'mongoDBHelpExplorer',
        this._treeController,
        this._telemetryService
      );
      this._treeController.activateTreeViewEventHandlers(
        this._treeView,
        this._telemetryService
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
