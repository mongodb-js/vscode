import * as vscode from 'vscode';
import NotebooksTreeHeader from './notebooksTreeHeader';
import { NOTEBOOK_ITEM } from './notebooksTreeItem';
import { createLogger } from '../logging';
import NotebooksTreeItem from './notebooksTreeItem';
import EXTENSION_COMMANDS from '../commands';
import { getNotebooks } from '../utils/notebook';

const log = createLogger('notebooks tree controller');

export default class NotebooksTree
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  public excludeFromNotebooksSearch: string[];
  private _notebooksTreeHeaders: NotebooksTreeHeader[];
  private _onDidChangeTreeData: vscode.EventEmitter<any>;
  private _notebooksTreeItems: { [key: string]: NotebooksTreeItem };
  readonly onDidChangeTreeData: vscode.Event<any>;

  contextValue = 'notebooksTree' as const;

  constructor() {
    this.excludeFromNotebooksSearch =
      vscode.workspace
        .getConfiguration('mdb')
        .get('excludeFromNotebooksSearch') || [];
    this._notebooksTreeHeaders = [];
    this._notebooksTreeItems = {};
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

        if (selectedItem.contextValue === NOTEBOOK_ITEM) {
          await vscode.commands.executeCommand(
            EXTENSION_COMMANDS.MDB_OPEN_NOTEBOOK_FROM_TREE_VIEW,
            selectedItem
          );
        }
      }
    });
  };

  public refresh = (): Promise<boolean> => {
    this.excludeFromNotebooksSearch =
      vscode.workspace
        .getConfiguration('mdb')
        .get('excludeFromNotebooksSearch') || [];

    this._onDidChangeTreeData.fire(null);

    return Promise.resolve(true);
  };

  public onTreeItemUpdate(): void {
    this._onDidChangeTreeData.fire(null);
  }

  public getTreeItem(element: NotebooksTreeHeader): vscode.TreeItem {
    return element;
  }

  public async getNotebooks(fsPath: string): Promise<any> {
    const excludeFromPlaygroundsSearch: string[] =
      (await vscode.workspace
        .getConfiguration('mdb')
        .get('excludeFromPlaygroundsSearch')) || [];

    const notebooks = await getNotebooks({
      fsPath,
      excludeFromPlaygroundsSearch,
    });

    this._notebooksTreeItems = {};

    notebooks.forEach((element) => {
      this._notebooksTreeItems[element.path] = new NotebooksTreeItem(
        element.name,
        element.path
      );
    });

    return this._notebooksTreeItems;
  }

  public async getChildren(element?: any): Promise<any[]> {
    // When no element is present we are at the root.
    if (!element) {
      this._notebooksTreeHeaders = [];

      let workspaceFolders = vscode.workspace.workspaceFolders;

      if (workspaceFolders) {
        workspaceFolders = workspaceFolders.filter(
          (folder) => folder.uri.scheme === 'file'
        );

        for (const folder of workspaceFolders) {
          const notebooks = await this.getNotebooks(folder.uri.fsPath);

          if (Object.keys(notebooks).length > 0) {
            this._notebooksTreeHeaders.push(
              new NotebooksTreeHeader(folder.uri, notebooks)
            );
          }
        }
      }

      return Promise.resolve(this._notebooksTreeHeaders);
    }

    return element.getChildren();
  }
}
