import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import PlaygroundsTreeItem from './playgroundsTreeItem';
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

export default class PlaygroundsTreeHeader extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<vscode.TreeItem> {
  contextValue = 'playgroundsTreeItem';

  private _playgroundsTreeItems: { [key: string]: PlaygroundsTreeItem };

  isExpanded = true;
  cacheIsUpToDate = false; // Unused because this is a synchronous resource.
  needsToRefreshExpansionState = false;

  constructor(existingPlaygroundsItemsCache: {
    [key: string]: PlaygroundsTreeItem;
  }) {
    super(rootLabel, vscode.TreeItemCollapsibleState.Expanded);

    this._playgroundsTreeItems = existingPlaygroundsItemsCache;
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

  private async readDirectory(uri: vscode.Uri): Promise<void> {
    const fileNames = await this.getFileNames(uri.fsPath);

    for (let i = 0; i < fileNames.length; i++) {
      const fileName = fileNames[i];

      try {
        const stat = await this.getStat(path.join(uri.fsPath, fileName));
        const fileUri = vscode.Uri.file(path.join(uri.fsPath, fileName));

        if (
          stat.type === vscode.FileType.File &&
          fileName.split('.').pop() === 'mongodb'
        ) {
          console.log('fileUri----------------------');
          console.log(fileUri);
          console.log('----------------------');

          this._playgroundsTreeItems[fileUri.fsPath] = new PlaygroundsTreeItem(
            fileName,
            fileUri.fsPath
          );
        } else if (
          stat.type === vscode.FileType.Directory &&
          fileName !== 'node_modules'
        ) {
          await this.readDirectory(fileUri);
        }
      } catch (error) {}
    }
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    this._playgroundsTreeItems = {};

    let workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders) {
      workspaceFolders = workspaceFolders.filter(
        (folder) => folder.uri.scheme === 'file'
      );

      for (const folder of workspaceFolders) {
        await this.readDirectory(folder.uri);
      }
    }

    console.log('this._playgroundsTreeItems----------------------');
    console.log(this._playgroundsTreeItems);
    console.log('----------------------');

    return Promise.resolve(
      sortTreeItemsByLabel(Object.values(this._playgroundsTreeItems))
    );
  }

  playgroundsDidChange(): void {
    // When the playgrounds change, like a playground is added or removed,
    // we want to open the playgrounds dropdown if it's collapsed.
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

  getPlaygroundsItemsCache(): { [key: string]: PlaygroundsTreeItem } {
    return this._playgroundsTreeItems;
  }
}
