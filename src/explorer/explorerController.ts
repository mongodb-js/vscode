import type * as vscode from 'vscode';

import type ConnectionController from '../connectionController';
import ExplorerTreeController from './explorerTreeController';
import { createTrackedTreeView } from '../utils/treeViewHelper';
import type { TelemetryService } from '../telemetry';

export default class ExplorerController {
  private _connectionController: ConnectionController;
  private _telemetryService: TelemetryService;
  private _treeController: ExplorerTreeController;
  private _treeView?: vscode.TreeView<vscode.TreeItem>;

  constructor(
    connectionController: ConnectionController,
    telemetryService: TelemetryService,
  ) {
    this._connectionController = connectionController;
    this._telemetryService = telemetryService;
    this._treeController = new ExplorerTreeController(
      this._connectionController,
      this._telemetryService,
    );
  }

  private createTreeView = (): void => {
    // Remove the listener that called this function.
    this._connectionController.removeEventListener(
      'CONNECTIONS_DID_CHANGE',
      this.createTreeView,
    );

    if (!this._treeView) {
      this._treeView = createTrackedTreeView(
        'mongoDBConnectionExplorer',
        this._treeController,
        this._telemetryService,
      );
      this._treeController.activateTreeViewEventHandlers(this._treeView);
    }
  };

  public activateConnectionsTreeView(): void {
    // Listen for a change in connections to occur before we create the tree
    // so that we show the `viewsWelcome` before any connections are added.
    this._connectionController.addEventListener(
      'CONNECTIONS_DID_CHANGE',
      this.createTreeView,
    );
  }

  public deactivate(): void {
    if (this._treeController) {
      this._treeController.removeListeners();
    }

    if (this._treeView) {
      this._treeView.dispose();
      delete this._treeView;
    }
  }

  public refresh(): boolean {
    if (this._treeController) {
      return this._treeController.refresh();
    }

    throw new Error('No tree to refresh.');
  }

  // Exposed for testing.
  public getConnectionsTreeView():
    | vscode.TreeView<vscode.TreeItem>
    | undefined {
    return this._treeView;
  }

  public getTreeController(): ExplorerTreeController {
    return this._treeController;
  }
}
