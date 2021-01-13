import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import PlaygroundsTreeHeader from './playgroundsTreeHeader';
import { PLAYGROUND_ITEM } from './playgroundsTreeItem';
import { createLogger } from '../logging';
import PlaygroundsTreeItem from './playgroundsTreeItem';
import EXTENSION_COMMANDS from '../commands';

const micromatch = require('micromatch');
const log = createLogger('playgrounds tree controller');

export class FileStat implements vscode.FileStat {
  constructor(private fsStat: fs.Stats) {}

  get type(): vscode.FileType {
    if (this.fsStat.isFile()) {
      return vscode.FileType.File;
    }
    if (this.fsStat.isDirectory()) {
      return vscode.FileType.Directory;
    }
    if (this.fsStat.isSymbolicLink()) {
      return vscode.FileType.SymbolicLink;
    }

    return vscode.FileType.Unknown;
  }

  get isFile(): boolean | undefined {
    return this.fsStat.isFile();
  }

  get isDirectory(): boolean | undefined {
    return this.fsStat.isDirectory();
  }

  get isSymbolicLink(): boolean | undefined {
    return this.fsStat.isSymbolicLink();
  }

  get size(): number {
    return this.fsStat.size;
  }

  get ctime(): number {
    return this.fsStat.ctime.getTime();
  }

  get mtime(): number {
    return this.fsStat.mtime.getTime();
  }
}

export default class PlaygroundsTree
implements vscode.TreeDataProvider<vscode.TreeItem> {
  public excludeFromPlaygroundsSearch: string[];
  private _playgroundsTreeHeaders: PlaygroundsTreeHeader[];
  private _onDidChangeTreeData: vscode.EventEmitter<any>;
  private _playgroundsTreeItems: { [key: string]: PlaygroundsTreeItem };
  readonly onDidChangeTreeData: vscode.Event<any>;

  contextValue = 'playgroundsTree';

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

  private getFileNames(filePath: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(filePath, (error, files) => {
        if (error) {
          reject(error);
        } else {
          resolve(files);
        }
      });
    });
  }

  private stat(filePath: string): Promise<fs.Stats> {
    return new Promise<fs.Stats>((resolve, reject) => {
      fs.stat(filePath, (error, stat) => {
        if (error) {
          reject(error);
        } else {
          resolve(stat);
        }
      });
    });
  }

  private async getStat(filePath: string): Promise<vscode.FileStat> {
    return new FileStat(await this.stat(filePath));
  }

  public async readDirectory(uri: vscode.Uri): Promise<void> {
    const fileNames = await this.getFileNames(uri.fsPath);

    for (let i = 0; i < fileNames.length; i++) {
      const fileName = fileNames[i];

      try {
        const stat = await this.getStat(path.join(uri.fsPath, fileName));
        const fileUri = vscode.Uri.file(path.join(uri.fsPath, fileName));
        const fileNameParts = fileName.split('.');

        if (
          stat.type === vscode.FileType.File &&
          fileNameParts.length > 1 &&
          fileNameParts.pop() === 'mongodb'
        ) {
          this._playgroundsTreeItems[fileUri.fsPath] = new PlaygroundsTreeItem(
            fileName,
            fileUri.fsPath
          );
        } else if (
          stat.type === vscode.FileType.Directory &&
          !micromatch.isMatch(fileName, this.excludeFromPlaygroundsSearch)
        ) {
          await this.readDirectory(fileUri);
        }
      } catch (error) { /* */ }
    }
  }

  public async getPlaygrounds(folderUri: vscode.Uri): Promise<any> {
    this._playgroundsTreeItems = {};

    await this.readDirectory(folderUri);

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
