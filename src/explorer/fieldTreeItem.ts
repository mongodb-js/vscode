import * as vscode from 'vscode';

export enum FieldTypes {
  document = 'Document',
  array = 'Array'
}

export type SchemaFieldType = {
  name: string;
  isExpanded: boolean;
  probability: number;
  bsonType: string | undefined;
  type: string | undefined;
  types: SchemaFieldType[];

  // Note: Fields only exist on nested fields in the 'types' array.
  fields: SchemaFieldType[] | undefined;
};

export function fieldIsExpandable(field: SchemaFieldType): boolean {
  return (
    field.probability === 1 &&
    (
      field.type === FieldTypes.document ||
      field.type === FieldTypes.array ||
      field.bsonType === FieldTypes.document ||
      field.bsonType === FieldTypes.array
    )
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
  implements vscode.TreeDataProvider<FieldTreeItem> {
  // This is a flag which notes that when this tree element is updated,
  // the tree view does not have to fully update like it does with
  // asynchronous resources.
  doesNotRequireTreeUpdate = true;

  field: SchemaFieldType;

  contextValue = 'fieldTreeItem';

  fieldName: string;

  constructor(field: SchemaFieldType) {
    super(field.name, getCollapsibleStateForField(field));

    this.field = field;

    this.fieldName = field.name;
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

    if (this.field.bsonType === FieldTypes.document) {
      const subDocumentFields = this.field.fields;
      return Promise.resolve(
        subDocumentFields
          ? subDocumentFields.map((subField) => new FieldTreeItem(subField))
          : []
      );
    } else if (this.field.type === FieldTypes.document) {
      const subDocumentFields = this.field.types[0].fields;
      return Promise.resolve(
        subDocumentFields
          ? subDocumentFields.map((subField) => new FieldTreeItem(subField))
          : []
      );
    } else if (
      this.field.type === FieldTypes.array || this.field.bsonType === FieldTypes.array
    ) {
      const arrayElement = this.field.types[0];
      return Promise.resolve([
        new FieldTreeItem(arrayElement)
      ]);
    }

    return Promise.resolve([]);
  }

  onDidCollapse(): void {
    this.field.isExpanded = false;
  }

  onDidExpand(): Promise<boolean> {
    this.field.isExpanded = true;

    return Promise.resolve(true);
  }
}
