import * as vscode from 'vscode';
import PlaygroundsTreeHeader from './playgroundsTreeHeader';
import { PLAYGROUND_ITEM } from './playgroundsTreeItem';
import { createLogger } from '../logging';
import PlaygroundsTreeItem from './playgroundsTreeItem';
import EXTENSION_COMMANDS from '../commands';
import { readDirectory } from '../utils/playground';

const log = createLogger('playgrounds tree controller');

export default class PlaygroundsTree
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  public excludeFromPlaygroundsSearch: string[];
  private _playgroundsTreeHeaders: PlaygroundsTreeHeader[];
  private _onDidChangeTreeData: vscode.EventEmitter<any>;
  private _playgroundsTreeItems: { [key: string]: PlaygroundsTreeItem };
  readonly onDidChangeTreeData: vscode.Event<any>;

  contextValue = 'playgroundsTree' as const;

  constructor() {
    this.excludeFromPlaygroundsSearch =
      vscode.workspace
        .getConfiguration('mdb')
        .get('excludeFromPlaygroundsSearch') || [];
    this._playgroundsTreeHeaders = [];
    this._playgroundsTreeItems = {};
    this._onDidChangeTreeData = new vscode.EventEmitter<void>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  public activateTreeViewEventHandlers = (
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

    treeView.onDidExpandElement(async (event: any): Promise<void> => {
      log.info('Tree item was expanded:', event.element.label);

      if (!event.element.onDidExpand) {
        return;
      }

      await event.element.onDidExpand();

      if (event.element.doesNotRequireTreeUpdate) {
        // When the element is already loaded (synchronous), we do not
        // need to fully refresh the tree.
        return;
      }

      this.onTreeItemUpdate();
    });

    treeView.onDidChangeSelection(async (event: any) => {
      if (event.selection && event.selection.length === 1) {
        const selectedItem = event.selection[0];

        if (selectedItem.contextValue === PLAYGROUND_ITEM) {
          await vscode.commands.executeCommand(
            EXTENSION_COMMANDS.MDB_OPEN_PLAYGROUND_FROM_TREE_VIEW,
            selectedItem
          );
        }
      }
    });
  };

  public refresh = (): Promise<boolean> => {
    this.excludeFromPlaygroundsSearch =
      vscode.workspace
        .getConfiguration('mdb')
        .get('excludeFromPlaygroundsSearch') || [];

    this._onDidChangeTreeData.fire(null);

    return Promise.resolve(true);
  };

  public onTreeItemUpdate(): void {
    this._onDidChangeTreeData.fire(null);
  }

  public getTreeItem(element: PlaygroundsTreeHeader): vscode.TreeItem {
    return element;
  }

  public async getPlaygrounds(folderUri: vscode.Uri): Promise<any> {
    const playgrounds = await readDirectory(folderUri.fsPath);
    this._playgroundsTreeItems = {};

    playgrounds.forEach(element => {
      this._playgroundsTreeItems[element.path] = new PlaygroundsTreeItem(
        element.name,
        element.path
      );
    });

    return this._playgroundsTreeItems;
  }

  public async getChildren(element?: any): Promise<any[]> {
    // When no element is present we are at the root.
    if (!element) {
      this._playgroundsTreeHeaders = [];

      let workspaceFolders = vscode.workspace.workspaceFolders;

      if (workspaceFolders) {
        workspaceFolders = workspaceFolders.filter(
          (folder) => folder.uri.scheme === 'file'
        );

        for (const folder of workspaceFolders) {
          const playgrounds = await this.getPlaygrounds(folder.uri);

          if (Object.keys(playgrounds).length > 0) {
            this._playgroundsTreeHeaders.push(
              new PlaygroundsTreeHeader(folder.uri, playgrounds)
            );
          }
        }
      }

      return Promise.resolve(this._playgroundsTreeHeaders);
    }

    return element.getChildren();
  }
}
