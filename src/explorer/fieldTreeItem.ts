import * as vscode from 'vscode';
import TreeItemParentInterface from './treeItemParentInterface';

export enum FieldTypes {
  document = 'Document',
  array = 'Array'
}

export type SchemaFieldType = {
  name: string;
  probability: number;
  bsonType: string | undefined;
  type: string | undefined;
  types: SchemaFieldType[];

  // Note: Fields only exist on nested fields in the 'types' array.
  fields: SchemaFieldType[] | undefined;
};

export const fieldIsExpandable = (field: SchemaFieldType): boolean => {
  return (
    field.probability === 1 &&
    (field.type === FieldTypes.document ||
      field.type === FieldTypes.array ||
      field.bsonType === FieldTypes.document ||
      field.bsonType === FieldTypes.array)
  );
};

const getCollapsibleStateForField = (
  field: SchemaFieldType,
  isExpanded: boolean
): vscode.TreeItemCollapsibleState => {
  if (!fieldIsExpandable(field)) {
    return vscode.TreeItemCollapsibleState.None;
  }

  return isExpanded
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.Collapsed;
};

export default class FieldTreeItem extends vscode.TreeItem
  implements vscode.TreeDataProvider<FieldTreeItem>, TreeItemParentInterface {
  // This is a flag which notes that when this tree element is updated,
  // the tree view does not have to fully update like it does with
  // asynchronous resources.
  doesNotRequireTreeUpdate = true;

  private _childrenCache: { [fieldName: string]: FieldTreeItem } = {};

  field: SchemaFieldType;
  fieldName: string;

  contextValue = 'fieldTreeItem';

  isExpanded: boolean;

  constructor(field: SchemaFieldType, isExpanded: boolean, existingCache: { [fieldName: string]: FieldTreeItem }) {
    super(field.name, getCollapsibleStateForField(field, isExpanded));

    this.field = field;
    this.fieldName = field.name;

    this.isExpanded = isExpanded;
    this._childrenCache = existingCache;
  }

  get tooltip(): string {
    return this.fieldName;
  }

  getTreeItem(element: FieldTreeItem): FieldTreeItem {
    return element;
  }

  getChildren(): Thenable<FieldTreeItem[]> {
    if (!fieldIsExpandable(this.field)) {
      return Promise.resolve([]);
    }

    const pastChildrenCache = this._childrenCache;
    this._childrenCache = {};

    if (this.field.bsonType === FieldTypes.document || this.field.type === FieldTypes.document) {
      let subDocumentFields;
      if (this.field.type === FieldTypes.document) {
        subDocumentFields = this.field.types[0].fields;
      } else if (this.field.bsonType === FieldTypes.document) {
        subDocumentFields = this.field.fields;
      }

      if (subDocumentFields) {
        subDocumentFields.forEach((subField) => {
          if (pastChildrenCache[subField.name]) {
            this._childrenCache[subField.name] = new FieldTreeItem(
              subField,
              pastChildrenCache[subField.name].isExpanded,
              pastChildrenCache[subField.name].getChildrenCache()
            );
          } else {
            this._childrenCache[subField.name] = new FieldTreeItem(
              subField,
              false,
              {},
            );
          }
        });
      }
    } else if (
      this.field.type === FieldTypes.array ||
      this.field.bsonType === FieldTypes.array
    ) {
      const arrayElement = this.field.types[0];

      if (pastChildrenCache[arrayElement.name]) {
        this._childrenCache[arrayElement.name] = new FieldTreeItem(
          arrayElement,
          pastChildrenCache[arrayElement.name].isExpanded,
          pastChildrenCache[arrayElement.name].getChildrenCache()
        );
      } else {
        this._childrenCache[arrayElement.name] = new FieldTreeItem(
          arrayElement,
          false,
          {},
        );
      }
    }

    return Promise.resolve(Object.values(this._childrenCache));
  }

  onDidCollapse(): void {
    this.isExpanded = false;
  }

  onDidExpand(): Promise<boolean> {
    this.isExpanded = true;

    return Promise.resolve(true);
  }

  getChildrenCache(): { [fieldName: string]: FieldTreeItem } {
    return this._childrenCache;
  }
}
