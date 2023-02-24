import * as vscode from 'vscode';
import path = require('path');
import { getImagesPath } from '../extensionConstants';

export const NOTEBOOK_ITEM = 'notebooksTreeItem';

function getIconPath(): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'file-light.svg'),
    dark: path.join(DARK, 'file-light.svg'),
  };
}

export default class NotebooksTreeItem
  extends vscode.TreeItem
  implements vscode.TreeDataProvider<NotebooksTreeItem>
{
  public filePath: string;

  contextValue = NOTEBOOK_ITEM;

  constructor(fileName: string, filePath: string) {
    super(fileName);
    this.filePath = filePath;

    this.tooltip = this.filePath;
    this.iconPath = getIconPath();
  }

  public getTreeItem(element: NotebooksTreeItem): NotebooksTreeItem {
    return element;
  }

  public getChildren(): Thenable<NotebooksTreeItem[]> {
    return Promise.resolve([]);
  }
}
