import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ConnectionTreeItem from './connectionTreeItem';
import TreeItemParent from './treeItemParentInterface';
import { sortTreeItemsByLabel } from './treeItemUtils';

const rootLabel = 'Playgrounds';
const rootTooltip = 'Your MongoDB playgrounds';

export class FileStat implements vscode.FileStat {
  constructor(private fsStat: fs.Stats) {}

  get type(): vscode.FileType {
    return this.fsStat.isFile()
      ? vscode.FileType.File
      : this.fsStat.isDirectory()
      ? vscode.FileType.Directory
      : this.fsStat.isSymbolicLink()
      ? vscode.FileType.SymbolicLink
      : vscode.FileType.Unknown;
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

export default class PlaygroundsTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<vscode.TreeItem> {
  contextValue = 'playgroundsTreeItem';

  private _connectionTreeItems: { [key: string]: ConnectionTreeItem };

  isExpanded = true;
  cacheIsUpToDate = false; // Unused because this is a synchronous resource.
  needsToRefreshExpansionState = false;

  constructor(existingConnectionItemsCache: {
    [key: string]: ConnectionTreeItem;
  }) {
    super(rootLabel, vscode.TreeItemCollapsibleState.Expanded);

    this._connectionTreeItems = existingConnectionItemsCache;
  }

  get tooltip(): string {
    return rootTooltip;
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  private getFileNames(path: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(path, (error, files) => {
        if (error) {
          reject(error);
        } else {
          resolve(files);
        }
      });
    });
  }

  private stat(path: string): Promise<fs.Stats> {
    return new Promise<fs.Stats>((resolve, reject) => {
      fs.stat(path, (error, stat) => {
        if (error) {
          reject(error);
        } else {
          resolve(stat);
        }
      });
    });
  }

  private async getStat(path: string): Promise<vscode.FileStat> {
    return new FileStat(await this.stat(path));
  }

  private async readDirectory(uri: vscode.Uri): Promise<vscode.Uri[]> {
    const fileNames = await this.getFileNames(uri.fsPath);
    const result: vscode.Uri[] = [];

    for (let i = 0; i < fileNames.length; i++) {
      const fileName = fileNames[i];
      const stat = await this.getStat(path.join(uri.fsPath, fileName));
      const fileUri = vscode.Uri.file(path.join(uri.fsPath, fileName));

      if (
        stat.type === vscode.FileType.File &&
        fileName.split('.').pop() === 'mongodb'
      ) {
        result.push(fileUri);
      } else if (
        stat.type === vscode.FileType.Directory &&
        fileName !== 'node_modules'
      ) {
        this.readDirectory(fileUri);
      }
    }

    console.log('result----------------------');
    console.log(result);
    console.log('----------------------');

    return Promise.resolve(result);
  }

  getChildren(): Thenable<vscode.TreeItem[]> {
    this._connectionTreeItems = {};

    let workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders) {
      workspaceFolders = workspaceFolders.filter(
        (folder) => folder.uri.scheme === 'file'
      );

      for (const folder of workspaceFolders) {
        this.readDirectory(folder.uri);
      }
    }

    return Promise.resolve(
      sortTreeItemsByLabel(Object.values(this._connectionTreeItems))
    );
  }

  connectionsDidChange(): void {
    // When the connections change, like a connection is added or removed,
    // we want to open the connections dropdown if it's collapsed.
    if (!this.isExpanded) {
      this.needsToRefreshExpansionState = true;
    }
  }

  onDidCollapse(): void {
    this.isExpanded = false;
  }

  onDidExpand(): Promise<boolean> {
    this.isExpanded = true;
    return Promise.resolve(true);
  }

  getPlaygroundsItemsCache(): { [key: string]: ConnectionTreeItem } {
    return this._connectionTreeItems;
  }
}
