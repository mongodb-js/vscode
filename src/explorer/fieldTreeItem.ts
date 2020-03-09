import * as vscode from 'vscode';

import TreeItemParent from './treeItemParentInterface';

export enum FieldTypes {
  document = 'Document',
  array = 'Array'
}

export type SchemaFieldType = {
  name: string;
  isExpanded: boolean;
  probability: number;
  type: string;
  fields: SchemaFieldType[] | undefined;
};

function fieldIsExpandable(field: SchemaFieldType): boolean {
  return (
    field.probability === 1 &&
    (field.type === FieldTypes.document || field.type === FieldTypes.array)
  );
}

function getCollapsibleStateForField(
  field: SchemaFieldType
): vscode.TreeItemCollapsibleState {
  if (!fieldIsExpandable(field)) {
    return vscode.TreeItemCollapsibleState.None;
  }

  return field.isExpanded
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.Collapsed;
}

export default class FieldTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<FieldTreeItem> {
  _childrenCacheIsUpToDate = false;
  private _childrenCache: vscode.TreeItem[] = [];

  field: SchemaFieldType;

  contextValue = 'fieldTreeItem';

  fieldName: string;

  isExpanded: boolean;

  constructor(field: SchemaFieldType) {
    super(field.name, getCollapsibleStateForField(field));

    this.field = field;

    this.fieldName = field.name;

    this.isExpanded = field.isExpanded;

    // if (existingCache !== null) {
    //   this._childrenCache = existingCache;
    //   this._childrenCacheIsUpToDate = true;
    // }
  }

  get tooltip(): string {
    return this.fieldName;
  }

  getTreeItem(element: FieldTreeItem): FieldTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!fieldIsExpandable(this.field)) {
      return Promise.resolve([]);
    }

    return new Promise((resolve) => {
      resolve(
        this.field.fields
          ? this.field.fields.map((subField) => new FieldTreeItem(subField))
          : []
      );
    });
  }

  onShowMoreClicked(): void {
    this._childrenCacheIsUpToDate = false;
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this._childrenCacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this._childrenCacheIsUpToDate = false;
    this.isExpanded = true;

    return Promise.resolve(true);
  }

  resetCache(): void {
    this._childrenCache = [];
    this._childrenCacheIsUpToDate = false;
  }

  getChildrenCache(): vscode.TreeItem[] | null {
    if (this._childrenCacheIsUpToDate) {
      return this._childrenCache;
    }

    return null;
  }
}
