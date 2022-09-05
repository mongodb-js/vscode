import * as vscode from 'vscode';
import path = require('path');
import { getImagesPath } from '../extensionConstants';

export const PLAYGROUND_ITEM = 'playgroundsTreeItem';

function getIconPath(): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'file-light.svg'),
    dark: path.join(DARK, 'file-light.svg'),
  };
}

export default class PlaygroundsTreeItem
  extends vscode.TreeItem
  implements vscode.TreeDataProvider<PlaygroundsTreeItem>
{
  public filePath: string;

  contextValue = PLAYGROUND_ITEM;

  constructor(fileName: string, filePath: string) {
    super(fileName);
    this.filePath = filePath;

    this.tooltip = this.filePath;
    this.iconPath = getIconPath();
  }

  public getTreeItem(element: PlaygroundsTreeItem): PlaygroundsTreeItem {
    return element;
  }

  public getChildren(): Thenable<PlaygroundsTreeItem[]> {
    return Promise.resolve([]);
  }
}
