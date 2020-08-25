import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import TreeItemParent from './treeItemParentInterface';
import PlaygroundsTreeItem from './playgroundsTreeItem';
import { sortTreeItemsByLabel } from './treeItemUtils';

const micromatch = require('micromatch');

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
  private _playgroundsTreeItems: { [key: string]: PlaygroundsTreeItem };
  private _excludeFromPlaygroundsSearch: string[];
  private _rootUri: vscode.Uri;

  contextValue = 'playgroundsTreeHeader';
  isExpanded = true;
  doesNotRequireTreeUpdate = true;
  cacheIsUpToDate = true;

  constructor(
    fileUri: vscode.Uri,
    existingPlaygroundsItemsCache: {
      [key: string]: PlaygroundsTreeItem;
    }
  ) {
    super(fileUri.path, vscode.TreeItemCollapsibleState.Expanded);
    this._rootUri = fileUri;
    this._playgroundsTreeItems = existingPlaygroundsItemsCache;
    this._excludeFromPlaygroundsSearch =
      vscode.workspace
        .getConfiguration('mdb')
        .get('excludeFromPlaygroundsSearch') || [];
  }

  get tooltip(): string {
    return rootTooltip;
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
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

  public async readDirectory(uri: vscode.Uri): Promise<void> {
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
          this._playgroundsTreeItems[fileUri.fsPath] = new PlaygroundsTreeItem(
            fileName,
            fileUri.fsPath
          );
        } else if (
          stat.type === vscode.FileType.Directory &&
          !micromatch.isMatch(fileName, this._excludeFromPlaygroundsSearch)
        ) {
          await this.readDirectory(fileUri);
        }
      } catch (error) {}
    }
  }

  public async getChildren(): Promise<vscode.TreeItem[]> {
    this._playgroundsTreeItems = {};

    await this.readDirectory(this._rootUri);

    return Promise.resolve(
      sortTreeItemsByLabel(Object.values(this._playgroundsTreeItems))
    );
  }

  public onDidCollapse(): void {
    this.isExpanded = false;
  }

  public onDidExpand(): Promise<boolean> {
    this.isExpanded = true;

    return Promise.resolve(true);
  }

  public getPlaygroundsItemsCache(): { [key: string]: PlaygroundsTreeItem } {
    return this._playgroundsTreeItems;
  }
}
