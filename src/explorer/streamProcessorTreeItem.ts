import * as vscode from 'vscode';
import path from 'path';
import type { DataService } from 'mongodb-data-service';

import formatError from '../utils/formatError';
import { getImagesPath } from '../extensionConstants';
import type TreeItemParent from './treeItemParentInterface';

function getIconPath(): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'stream-processor.svg'),
    dark: path.join(DARK, 'stream-processor.svg'),
  };
}

export default class StreamProcessorTreeItem
  extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<StreamProcessorTreeItem>
{
  contextValue = 'streamProcessorTreeItem' as const;
  cacheIsUpToDate = true;
  isExpanded: boolean;
  isDropped = false;

  streamProcessorName: string;
  streamProcessorState: string;

  private _dataService: DataService;

  constructor({
    streamProcessorName,
    streamProcessorState,
    dataService,
    isExpanded,
  }: {
    streamProcessorName: string;
    streamProcessorState: string;
    dataService: DataService;
    isExpanded: boolean;
  }) {
    super(
      streamProcessorName,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this._dataService = dataService;
    this.iconPath = getIconPath();
    this.isExpanded = isExpanded;
    this.tooltip = streamProcessorName;
    this.streamProcessorName = streamProcessorName;
    this.streamProcessorState = streamProcessorState;
  }

  getTreeItem(element: StreamProcessorTreeItem): StreamProcessorTreeItem {
    return element;
  }

  getChildren(): Promise<any[]> {
    return Promise.resolve(
      !this.isExpanded
        ? []
        : [
            new vscode.TreeItem(
              `State: ${this.streamProcessorState}`,
              vscode.TreeItemCollapsibleState.None
            ),
          ]
    );
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this.cacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this.cacheIsUpToDate = false;
    this.isExpanded = true;
    return Promise.resolve(true);
  }

  async onStartClicked(): Promise<boolean> {
    try {
      await this._dataService.startStreamProcessor(this.streamProcessorName);
      this.streamProcessorState = 'STARTED';
      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Start stream processor failed: ${formatError(error).message}`
      );
      return false;
    }
  }

  async onStopClicked(): Promise<boolean> {
    try {
      await this._dataService.stopStreamProcessor(this.streamProcessorName);
      this.streamProcessorState = 'STOPPED';
      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Stop stream processor failed: ${formatError(error).message}`
      );
      return false;
    }
  }

  // Prompt the user to input the name to confirm the drop, then drop.
  async onDropClicked(): Promise<boolean> {
    let inputtedName: string | undefined;
    try {
      inputtedName = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'e.g. myStreamProcessor',
        prompt: `Are you sure you wish to drop this stream processor? Enter the stream processor name '${this.streamProcessorName}' to confirm.`,
        validateInput: (inputName) => {
          if (inputName && this.streamProcessorName !== inputName) {
            return 'Stream processor name does not match';
          }
          return null;
        },
      });
    } catch (e) {
      return Promise.reject(
        new Error(`An error occured parsing the stream processor name: ${e}`)
      );
    }

    if (this.streamProcessorName !== inputtedName) {
      return Promise.resolve(false);
    }

    try {
      await this._dataService.dropStreamProcessor(this.streamProcessorName);
      this.streamProcessorState = 'DROPPED';
      this.isDropped = true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Drop stream processor failed: ${formatError(error).message}`
      );
    }
    return this.isDropped;
  }
}
