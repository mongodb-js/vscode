import * as vscode from 'vscode';
import * as path from 'path';

import { getImagesPath } from '../extensionConstants';
import TreeItemParent from './treeItemParentInterface';

export enum IndexKeyType {
  ASCENDING = 1,
  DESCENDING = -1,
  TEXT = 'text',
  HASHED = 'hashed',
  GEO = '2d', // flat, cartesian geometry
  GEOSPHERE = '2dsphere', // index assuming a spherical geometry
  GEOHAYSTACK = 'geoHaystack'
}

export type IndexModel = {
  v: number;
  key: {
    [key: string]: IndexKeyType;
  };
  name: string;
  ns: string;
};

function getIconNameForIndexKeyType(indexKeyType: IndexKeyType): string {
  if (indexKeyType === IndexKeyType.ASCENDING) {
    return 'ascending';
  }

  if (indexKeyType === IndexKeyType.DESCENDING) {
    return 'descending';
  }

  if (indexKeyType === IndexKeyType.TEXT) {
    return 'text';
  }

  if (indexKeyType === IndexKeyType.HASHED) {
    return 'hashed';
  }

  if (
    indexKeyType === IndexKeyType.GEO ||
    indexKeyType === IndexKeyType.GEOHAYSTACK ||
    indexKeyType === IndexKeyType.GEOSPHERE
  ) {
    return 'geospatial';
  }

  return '';
}

function getIndexFieldIconPath(indexKeyType: IndexKeyType): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  const iconName = getIconNameForIndexKeyType(indexKeyType);

  return {
    light: path.join(LIGHT, 'index', `${iconName}.svg`),
    dark: path.join(DARK, 'index', `${iconName}.svg`)
  };
}

export class IndexFieldTreeItem extends vscode.TreeItem
  implements vscode.TreeDataProvider<IndexFieldTreeItem> {
  indexKey: string;
  indexKeyType: IndexKeyType;

  constructor(indexKey: string, indexKeyType: IndexKeyType) {
    super(indexKey, vscode.TreeItemCollapsibleState.None);

    this.indexKey = indexKey;
    this.indexKeyType = indexKeyType;

    this.iconPath = getIndexFieldIconPath(indexKeyType);
    this.tooltip = `${indexKey}: ${indexKeyType}`;
  }

  getTreeItem(element: IndexFieldTreeItem): IndexFieldTreeItem {
    return element;
  }

  getChildren(): Thenable<IndexFieldTreeItem[]> {
    return Promise.resolve([]);
  }
}

export default class IndexTreeItem extends vscode.TreeItem
  implements vscode.TreeDataProvider<IndexTreeItem>, TreeItemParent {
  contextValue = 'indexTreeItem';

  index: IndexModel;

  namespace: string;

  // This is a flag which notes that when this tree element is updated,
  // the tree view does not have to fully update like it does with
  // asynchronous resources.
  doesNotRequireTreeUpdate = true;

  isExpanded: boolean;
  cacheIsUpToDate = true;

  constructor(index: IndexModel, namespace: string, isExpanded: boolean) {
    super(
      index.name,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.index = index;

    this.namespace = namespace;

    this.id = `${index.name}-${namespace}`;

    this.isExpanded = isExpanded;

    this.tooltip = index.name;
  }

  getTreeItem(element: IndexTreeItem): IndexTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.index.key) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      Object.keys(this.index.key).map(
        (indexKey) => new IndexFieldTreeItem(indexKey, this.index.key[indexKey])
      )
    );
  }

  onDidCollapse(): void {
    this.isExpanded = false;
  }

  onDidExpand(): Promise<boolean> {
    this.isExpanded = true;

    return Promise.resolve(true);
  }
}
