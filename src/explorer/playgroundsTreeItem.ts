import * as vscode from 'vscode';
import path = require('path');
import { getImagesPath } from '../extensionConstants';

export const PLAYGROUND_ITEM = 'playgroundsTreeItem';

function getIconPath():
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

export default class PlaygroundsTreeItem extends vscode.TreeItem
  implements vscode.TreeDataProvider<PlaygroundsTreeItem> {
  public filePath: string;

  contextValue = PLAYGROUND_ITEM;

  constructor(fileName: string, filePath: string) {
    super(fileName);
    this.filePath = filePath;

    this.tooltip = this.filePath;
  }

  public getTreeItem(element: PlaygroundsTreeItem): PlaygroundsTreeItem {
    return element;
  }

  public getChildren(): Thenable<PlaygroundsTreeItem[]> {
    return Promise.resolve([]);
  }
}
