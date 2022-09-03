import * as vscode from 'vscode';
import HelpTree from './helpTree';
import { createLogger } from '../logging';
import { TelemetryService } from '../telemetry';

const log = createLogger('help and info explorer controller');

export default class HelpExplorer {
  _treeController: HelpTree;
  _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor() {
    log.info('activate help explorer');
    this._treeController = new HelpTree();
  }

  activateHelpTreeView(telemetryService: TelemetryService): void {
    if (!this._treeView) {
      this._treeView = vscode.window.createTreeView('mongoDBHelpExplorer', {
        treeDataProvider: this._treeController
      });
      this._treeController.activateTreeViewEventHandlers(
        this._treeView,
        telemetryService
      );
      vscode.window.registerTreeDataProvider('mongoDBHelpExplorer', this._treeController);
    }
  }

  deactivate(): void {
    if (this._treeView) {
      this._treeView.dispose();
      delete this._treeView;
    }
  }
}
