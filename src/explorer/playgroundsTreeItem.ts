import * as vscode from 'vscode';
import path = require('path');
import TreeItemParent from './treeItemParentInterface';
import { getImagesPath } from '../extensionConstants';

export default class PlaygroundsTreeItem extends vscode.TreeItem
  implements vscode.TreeDataProvider<PlaygroundsTreeItem> {
  fileName: string;
  filePath: string;

  constructor(fileName: string, filePath: string) {
    super(fileName);

    this.fileName = fileName;
    this.filePath = filePath;
  }

  get tooltip(): string {
    return this.filePath;
  }

  get description(): string {
    return '';
  }

  getTreeItem(element: PlaygroundsTreeItem): PlaygroundsTreeItem {
    return element;
  }

  getChildren(): Thenable<PlaygroundsTreeItem[]> {
    return Promise.resolve([]);
  }

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(getImagesPath(), 'light');
    const DARK = path.join(getImagesPath(), 'dark');

    return {
      light: path.join(LIGHT, 'file-light.svg'),
      dark: path.join(DARK, 'file-light.svg')
    };
  }
}
