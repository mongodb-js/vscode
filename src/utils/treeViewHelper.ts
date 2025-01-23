import * as vscode from 'vscode';
import type { TelemetryService } from '../telemetry';

export function createTrackedTreeView(
  viewId: string,
  provider: vscode.TreeDataProvider<vscode.TreeItem>,
  telemetryService: TelemetryService
): vscode.TreeView<vscode.TreeItem> {
  const result = vscode.window.createTreeView(viewId, {
    treeDataProvider: provider,
  });

  result.onDidChangeVisibility((event) => {
    if (event.visible) {
      telemetryService.trackTreeViewActivated();
    }
  });

  return result;
}
