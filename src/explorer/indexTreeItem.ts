import * as vscode from 'vscode';

enum IndexKeyType {
  ASCENDING = 1,
  DESCENDING = -1,
  TEXT = 'text',
  HASHED = 'hashed',
  GEO = '2d', // flat, cartesian geometry
  GEOSPHERE = '2dsphere', // index assuming a spherical geometry
  GEOHAYSTACK = 'geoHaystack'
}

type IndexModel = {
  v: string;
  key: {
    [key: string]: IndexKeyType;
  };
  name: string;
  ns: string;
};

function getDisplayNameForIndexKeyType(indexKeyType: IndexKeyType): string {
  if (indexKeyType === IndexKeyType.ASCENDING) {
    return 'Ascending';
  }

  if (indexKeyType === IndexKeyType.DESCENDING) {
    return 'Descending';
  }

  if (indexKeyType === IndexKeyType.TEXT) {
    return 'Text';
  }

  if (indexKeyType === IndexKeyType.HASHED) {
    return 'Hashed';
  }

  if (
    indexKeyType === IndexKeyType.GEO ||
    indexKeyType === IndexKeyType.GEOHAYSTACK ||
    indexKeyType === IndexKeyType.GEOSPHERE
  ) {
    return 'Geospatial';
  }

  return '';
}

class IndexFieldTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<IndexFieldTreeItem> {
  indexKey: string;

  constructor(indexKey: string, indexKeyType: IndexKeyType) {
    super(
      indexKey,
      vscode.TreeItemCollapsibleState.None
    );

    this.indexKey = indexKey;

    this.description = getDisplayNameForIndexKeyType(indexKeyType);
  }

  get tooltip(): string {
    return this.indexKey;
  }

  getTreeItem(element: IndexFieldTreeItem): IndexFieldTreeItem {
    return element;
  }

  getChildren(): Thenable<IndexFieldTreeItem[]> {
    return Promise.resolve([]);
  }
}

export default class IndexTreeItem extends vscode.TreeItem
  implements vscode.TreeDataProvider<IndexTreeItem> {
  contextValue = 'indexTreeItem';

  private index: IndexModel;

  namespace: string;

  constructor(index: IndexModel, namespace: string) {
    super(
      index.name,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    this.index = index;

    this.namespace = namespace;
  }

  get tooltip(): string {
    return this.index.name;
  }

  getTreeItem(element: IndexTreeItem): IndexTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.index.key) {
      return Promise.resolve([]);
    }

    return Promise.resolve(Object.keys(this.index.key).map(
      indexKey => new IndexFieldTreeItem(indexKey, this.index.key[indexKey])
    ));
  }
}
