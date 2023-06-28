import * as vscode from 'vscode';
import HelpTree from './helpTree';
import { createLogger } from '../logging';
import { TelemetryService } from '../telemetry';

const log = createLogger('help and info explorer');

export default class HelpExplorer {
  _treeController: HelpTree;
  _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor() {
    this._treeController = new HelpTree();
  }

  activateHelpTreeView(telemetryService: TelemetryService): void {
    if (!this._treeView) {
      log.info('Activating help explorer...');
      this._treeView = vscode.window.createTreeView('mongoDBHelpExplorer', {
        treeDataProvider: this._treeController,
      });
      this._treeController.activateTreeViewEventHandlers(
        this._treeView,
        telemetryService
      );
      log.info('Help explorer activated');
    }
  }

  deactivate(): void {
    if (this._treeView) {
      this._treeView.dispose();
      delete this._treeView;
    }
  }
}
