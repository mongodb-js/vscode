import * as vscode from 'vscode';
const path = require('path');

import TreeItemParent from './treeItemParentInterface';
import { getImagesPath } from '../extensionConstants';

export const MAX_EVENTS_VISIBLE = 10;

export const CHANGE_STREAM_COLLECTION_ITEM = 'changeStreamItem';
export const CHANGE_STREAM_ITEM = 'changeStreamItem';

const ITEM_LABEL = 'Change Stream';

type ChangeStreamEvent = {
  _id: any;
  operationType: string;
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace changeStreams {
  export const changeStreamListeners: { [key: string]: any } = {};
  export const changeChangeStreamEvents: {
    [key: string]: ChangeStreamEvent[];
  } = {};
}

export class ChangeStreamTreeItem extends vscode.TreeItem {
  event: ChangeStreamEvent;

  contextValue = CHANGE_STREAM_ITEM;

  constructor(event: ChangeStreamEvent) {
    super(event.operationType, vscode.TreeItemCollapsibleState.None);
    this.label = event.operationType;
    this.description = event._id;

    this.event = event;
  }
}

export default class CollectionChangeStreamTreeItem extends vscode.TreeItem
  implements
    TreeItemParent,
    vscode.TreeDataProvider<CollectionChangeStreamTreeItem> {
  cacheIsUpToDate = false;
  private _childrenCache: ChangeStreamTreeItem[] = [];

  contextValue = CHANGE_STREAM_COLLECTION_ITEM;

  collectionName: string;
  databaseName: string;
  namespace: string;

  private _dataService: any;

  isExpanded: boolean;

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    cacheIsUpToDate: boolean,
    existingCache: Array<ChangeStreamTreeItem>
  ) {
    super(
      ITEM_LABEL,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.collectionName = collectionName;
    this.databaseName = databaseName;
    this.namespace = `${this.databaseName}.${this.collectionName}`;

    this._dataService = dataService;

    this.isExpanded = isExpanded;

    this._childrenCache = existingCache;
    this.cacheIsUpToDate = cacheIsUpToDate;
  }

  get tooltip(): string {
    return 'Expand to follow ';
  }

  getTreeItem(
    element: CollectionChangeStreamTreeItem
  ): CollectionChangeStreamTreeItem {
    return element;
  }

  getChildren(): Promise<any[]> {
    if (!this.isExpanded) {
      return Promise.resolve([]);
    }

    // TODO: Try async with 3 seconds between each.

    // TODO: add connection/dat serve id
    const changeStreamEventId = this.namespace;

    if (!changeStreams.changeStreamListeners[changeStreamEventId]) {
      const connectionClient = this._dataService.client;

      const clientDB = connectionClient._database(this.databaseName);

      const changeStream = clientDB.collection(this.collectionName).watch();

      changeStreams.changeChangeStreamEvents[changeStreamEventId] = [];
      changeStreams.changeStreamListeners[changeStreamEventId] = changeStream;
      changeStream.on('change', (event: ChangeStreamEvent) => {
        console.log('Change stream event occured:', event);
        vscode.commands.executeCommand('mdb.refreshExplorerTree');
        changeStreams.changeChangeStreamEvents[changeStreamEventId].push(event);
      });
    }

    if (
      changeStreams.changeChangeStreamEvents[changeStreamEventId] &&
      changeStreams.changeChangeStreamEvents[changeStreamEventId].length > 0
    ) {
      const children: ChangeStreamTreeItem[] = [];
      changeStreams.changeChangeStreamEvents[changeStreamEventId].forEach(
        (changeEvent) => {
          children.unshift(new ChangeStreamTreeItem(changeEvent));
        }
      );

      return Promise.resolve(children);
    }

    return Promise.resolve([new vscode.TreeItem('Listening for changes...')]);
  }

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(getImagesPath(), 'light');
    const DARK = path.join(getImagesPath(), 'dark');

    return {
      light: path.join(LIGHT, 'play.svg'),
      dark: path.join(DARK, 'play.svg')
    };
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this.cacheIsUpToDate = false;

    // Do we close the change stream?
  }

  onDidExpand(): Promise<boolean> {
    this.cacheIsUpToDate = false;
    this.isExpanded = true;

    // TODO: Ensure the change stream is set up.

    return Promise.resolve(true);
  }

  resetCache(): Promise<void> {
    this.isExpanded = false;
    this._childrenCache = [];
    this.cacheIsUpToDate = false;

    return Promise.resolve();
  }

  getChildrenCache(): ChangeStreamTreeItem[] {
    return this._childrenCache;
  }
}
