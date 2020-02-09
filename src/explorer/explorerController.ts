import * as vscode from 'vscode';

import ConnectionController from '../connectionController';
import ExplorerDataProvider from './explorerTreeRoot';

import { createLogger } from '../logging';

const log = createLogger('explorer controller');

export default class ConnectionExplorerController {
  // private _connectionTreeViewer?: vscode.TreeView<vscode.TreeItem>;
  private _treeDataProvider?: ExplorerDataProvider;

  public activate(connectionController: ConnectionController) {
    this._treeDataProvider = new ExplorerDataProvider(connectionController);

    // TODO: teardown?
    // this._connectionTreeViewer =
    const explorerTreeView = vscode.window.createTreeView('mongoDB', {
      treeDataProvider: this._treeDataProvider
    });

    explorerTreeView.onDidCollapseElement((event: any) => {
      log.info('Tree item was collapsed:', event.element.label);
      event.element.onDidCollapse();

      if (this._treeDataProvider) {
        this._treeDataProvider.onTreeItemUpdate();
      }
    });

    explorerTreeView.onDidExpandElement(async (event: any) => {
      log.info('Tree item was expanded:', event.element.label);
      await event.element.onDidExpand();

      if (this._treeDataProvider) {
        this._treeDataProvider.onTreeItemUpdate();
      }
    });

    explorerTreeView.onDidChangeSelection((event: any) => {
      if (this._treeDataProvider && event.selection && event.selection.length === 1) {
        if (event.selection[0].isShowMoreItem) {
          event.selection[0].onShowMoreClicked();
          this._treeDataProvider.onTreeItemUpdate();
        }
      }
    });
  }

  public refresh(): Promise<boolean> {
    if (!this._treeDataProvider) {
      return Promise.reject('MongoDB service has not yet activated.');
    }

    this._treeDataProvider.refresh();

    return Promise.resolve(true);
  }
}
