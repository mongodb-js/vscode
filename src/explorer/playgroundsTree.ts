import * as vscode from 'vscode';
import PlaygroundsTreeHeader from './playgroundsTreeHeader';
import { createLogger } from '../logging';

const log = createLogger('explorer controller');

export default class PlaygroundsTree
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _playgroundsTreeHeader: PlaygroundsTreeHeader;
  private _onDidChangeTreeData: vscode.EventEmitter<any>;
  readonly onDidChangeTreeData: vscode.Event<any>;

  constructor() {
    this._playgroundsTreeHeader = new PlaygroundsTreeHeader(
      {} // No cache to start.
    );

    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  activateTreeViewEventHandlers = (
    treeView: vscode.TreeView<vscode.TreeItem>
  ): void => {
    treeView.onDidCollapseElement((event: any) => {
      log.info('Tree item was collapsed:', event.element.label);

      if (event.element.onDidCollapse) {
        event.element.onDidCollapse();
      }

      if (event.element.doesNotRequireTreeUpdate) {
        // When the element is already loaded (synchronous), we do not need to
        // fully refresh the tree.
        return;
      }

      this.onTreeItemUpdate();
    });

    treeView.onDidExpandElement(
      (event: any): Promise<void> => {
        log.info('Tree item was expanded:', event.element.label);

        return new Promise((resolve, reject) => {
          if (!event.element.onDidExpand) {
            return resolve();
          }

          event.element.onDidExpand().then(
            () => {
              if (event.element.doesNotRequireTreeUpdate) {
                // When the element is already loaded (synchronous), we do not
                // need to fully refresh the tree.
                return resolve();
              }

              this.onTreeItemUpdate();

              resolve();
            },
            (err: Error) => {
              reject(err);
            }
          );
        });
      }
    );

    treeView.onDidChangeSelection((event: any) => {
      if (event.selection && event.selection.length === 1) {
        const selectedItem = event.selection[0];

        if (selectedItem.isShowMoreItem) {
          selectedItem.onShowMoreClicked();

          this.onTreeItemUpdate();
        }
      }
    });
  };

  public refresh = (): Promise<boolean> => {
    this._playgroundsTreeHeader.playgroundsDidChange();
    this._onDidChangeTreeData.fire();

    return Promise.resolve(true);
  };

  public onTreeItemUpdate(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: PlaygroundsTreeHeader): vscode.TreeItem {
    return element;
  }

  getChildren(element?: any): Thenable<any[]> {
    // When no element is present we are at the root.
    if (!element) {
      // We rebuild the playgrounds tree each time in order to
      // manually control the expanded state of tree items.
      this._playgroundsTreeHeader = new PlaygroundsTreeHeader(
        this._playgroundsTreeHeader.getPlaygroundsItemsCache()
      );

      return Promise.resolve([this._playgroundsTreeHeader]);
    }

    return element.getChildren();
  }
}
