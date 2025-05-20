import * as vscode from 'vscode';
import path from 'path';

import { getImagesPath } from '../extensionConstants';
import type TreeItemParent from './treeItemParentInterface';

// Loosely based on bson types. These values match with the
// types returned by `parseSchema` with `mongodb-schema`.
// We have types for elements we have special handing for (icons).
// https://docs.mongodb.com/manual/reference/bson-types/
export enum FieldType {
  array = 'Array',
  binary = 'Binary',
  bool = 'Boolean',
  date = 'Date',
  decimal = 'Decimal128',
  document = 'Document',
  int = '32-bit integer',
  javascript = 'Javascript',
  long = '64-bit integer',
  null = 'Null',
  number = 'Number',
  object = 'Object',
  objectId = 'ObjectID',
  regex = 'Regular Expression',
  string = 'String',
  timestamp = 'Timestamp',
  undefined = 'Undefined',
}

export type SchemaFieldType = {
  name: string;
  probability: number;
  bsonType?: string;
  type?: string;
  types?: SchemaFieldType[];

  // Note: Fields only exist on nested fields in the 'types' array.
  fields?: SchemaFieldType[];
};

export const fieldIsExpandable = (field: SchemaFieldType): boolean => {
  return (
    field.probability === 1 &&
    (field.type === FieldType.document ||
      field.type === FieldType.array ||
      field.bsonType === FieldType.document ||
      field.bsonType === FieldType.array)
  );
};

const getCollapsibleStateForField = (
  field: SchemaFieldType,
  isExpanded: boolean,
): vscode.TreeItemCollapsibleState => {
  if (!fieldIsExpandable(field)) {
    return vscode.TreeItemCollapsibleState.None;
  }

  return isExpanded
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.Collapsed;
};

// eslint-disable-next-line complexity
export const getIconFileNameForField = (
  field: SchemaFieldType,
): null | string => {
  if (field.probability !== 1) {
    // The field doesn't exist on every document.
    return 'mixed-type';
  }
  const fieldType = field.type || field.bsonType;
  if (!fieldType) {
    // The field has polymorphic data types.
    return 'mixed-type';
  }
  if (fieldType === FieldType.array) {
    return 'array';
  }
  if (fieldType === FieldType.binary) {
    return 'binary';
  }
  if (fieldType === FieldType.bool) {
    return 'boolean';
  }
  if (fieldType === FieldType.date) {
    return 'date';
  }
  if (fieldType === FieldType.decimal) {
    return 'double';
  }
  if (fieldType === FieldType.null) {
    return 'null';
  }
  if (
    fieldType === FieldType.int ||
    fieldType === FieldType.long ||
    fieldType === FieldType.number
  ) {
    return 'number';
  }
  if (fieldType === FieldType.object || fieldType === FieldType.document) {
    return 'object';
  }
  if (fieldType === FieldType.objectId) {
    return 'object-id';
  }
  if (fieldType === FieldType.regex) {
    return 'regex';
  }
  if (fieldType === FieldType.string) {
    return 'string';
  }
  if (fieldType === FieldType.timestamp) {
    return 'timestamp';
  }

  // No icon.
  return null;
};

function getFieldTypeString(field: SchemaFieldType): string {
  if (field.probability !== 1) {
    // The field doesn't exist on every document.
    return 'mixed-type';
  }
  const fieldType = field.type || field.bsonType;
  if (!fieldType) {
    // The field has polymorphic data types.
    return 'mixed-type';
  }
  return fieldType;
}

function getIconPath(
  field: SchemaFieldType,
): string | { light: vscode.Uri; dark: vscode.Uri } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  const iconFileName = getIconFileNameForField(field);

  if (iconFileName === null) {
    // No icon.
    return '';
  }

  return {
    light: vscode.Uri.file(path.join(LIGHT, 'schema', `${iconFileName}.svg`)),
    dark: vscode.Uri.file(path.join(DARK, 'schema', `${iconFileName}.svg`)),
  };
}

export const FIELD_TREE_ITEM_CONTEXT_VALUE = 'fieldTreeItem';

export default class FieldTreeItem
  extends vscode.TreeItem
  implements vscode.TreeDataProvider<FieldTreeItem>, TreeItemParent
{
  // This is a flag which notes that when this tree element is updated,
  // the tree view does not have to fully update like it does with
  // asynchronous resources.
  doesNotRequireTreeUpdate = true;

  cacheIsUpToDate = true; // Unused because this is a synchronous resource.
  private _childrenCache: { [fieldName: string]: FieldTreeItem } = {};

  field: SchemaFieldType;
  fieldName: string;

  contextValue = FIELD_TREE_ITEM_CONTEXT_VALUE;

  isExpanded: boolean;

  iconPath: string | { light: vscode.Uri; dark: vscode.Uri };

  constructor({
    field,
    isExpanded,
    existingCache,
  }: {
    field: SchemaFieldType;
    isExpanded: boolean;
    existingCache: { [fieldName: string]: FieldTreeItem };
  }) {
    super(field.name, getCollapsibleStateForField(field, isExpanded));

    this.field = field;
    this.fieldName = field.name;

    this.isExpanded = isExpanded;
    this._childrenCache = existingCache;

    this.iconPath = getIconPath(field);
    this.tooltip = `${field.name} - ${getFieldTypeString(field)}`;
  }

  getTreeItem(element: FieldTreeItem): FieldTreeItem {
    return element;
  }

  // eslint-disable-next-line complexity
  getChildren(): Thenable<FieldTreeItem[]> {
    if (!fieldIsExpandable(this.field)) {
      return Promise.resolve([]);
    }

    const pastChildrenCache = this._childrenCache;
    this._childrenCache = {};

    if (
      this.field.bsonType === FieldType.document ||
      this.field.type === FieldType.document
    ) {
      let subDocumentFields;
      if (this.field.type === FieldType.document && this.field.types) {
        subDocumentFields = this.field.types[0].fields;
      } else if (this.field.bsonType === FieldType.document) {
        subDocumentFields = this.field.fields;
      }

      if (subDocumentFields) {
        subDocumentFields.forEach((subField) => {
          if (pastChildrenCache[subField.name]) {
            this._childrenCache[subField.name] = new FieldTreeItem({
              field: subField,
              isExpanded: pastChildrenCache[subField.name].isExpanded,
              existingCache:
                pastChildrenCache[subField.name].getChildrenCache(),
            });
          } else {
            this._childrenCache[subField.name] = new FieldTreeItem({
              field: subField,
              isExpanded: false,
              existingCache: {},
            });
          }
        });
      }
    } else if (
      (this.field.type === FieldType.array ||
        this.field.bsonType === FieldType.array) &&
      this.field.types
    ) {
      const arrayElement = this.field.types[0];
      const arrayElementFields = arrayElement.types;

      if (arrayElementFields) {
        arrayElementFields.forEach((arrayField) => {
          if (pastChildrenCache[arrayField.name]) {
            this._childrenCache[arrayField.name] = new FieldTreeItem({
              field: arrayField,
              isExpanded: pastChildrenCache[arrayField.name].isExpanded,
              existingCache:
                pastChildrenCache[arrayField.name].getChildrenCache(),
            });
          } else {
            this._childrenCache[arrayField.name] = new FieldTreeItem({
              field: arrayField,
              isExpanded: false,
              existingCache: {},
            });
          }
        });
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

  getFieldName(): string {
    return this.fieldName;
  }
}
