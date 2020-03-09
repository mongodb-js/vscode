import * as vscode from 'vscode';

import DocumentListTreeItem, {
  CollectionTypes,
  MAX_DOCUMENTS_VISIBLE
} from './documentListTreeItem';
import TreeItemParent from './treeItemParentInterface';
import SchemaTreeItem from './schemaTreeItem';

export default class CollectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<CollectionTreeItem> {
  static contextValue = 'collectionTreeItem';

  private _documentListChild: DocumentListTreeItem;
  private _schemaChild: SchemaTreeItem;

  isSynchronousResource = true;

  collectionName: string;
  databaseName: string;

  private _dataService: any;
  private _type: CollectionTypes;

  isExpanded: boolean;

  constructor(
    collection: any,
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    existingDocumentListChild?: DocumentListTreeItem,
    existingSchemaChild?: SchemaTreeItem
  ) {
    super(
      collection.name,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.collectionName = collection.name;
    this.databaseName = databaseName;

    this._type = collection.type; // Type can be `collection` or `view`.
    this._dataService = dataService;

    this.isExpanded = isExpanded;
    this._documentListChild = existingDocumentListChild
      ? existingDocumentListChild
      : new DocumentListTreeItem(
        this.collectionName,
        this.databaseName,
        this._type,
        this._dataService,
        false, // Collapsed.
        MAX_DOCUMENTS_VISIBLE,
        null // No existing cache.
      );
    this._schemaChild = existingSchemaChild
      ? existingSchemaChild
      : new SchemaTreeItem(
        this.collectionName,
        this.databaseName,
        this._dataService,
        false, // Collapsed.
        false, // Show more fields has not been clicked.
        null // No existing cache.
      );
  }

  get tooltip(): string {
    return this._type === CollectionTypes.view
      ? 'Read only view'
      : this.collectionName;
  }

  getTreeItem(element: CollectionTreeItem): CollectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    // We rebuild the children here so their controlled `expanded` state
    // is ensure to be set by vscode.
    this._documentListChild = new DocumentListTreeItem(
      this.collectionName,
      this.databaseName,
      this._type,
      this._dataService,
      this._documentListChild.isExpanded,
      this._documentListChild.getMaxDocumentsToShow(),
      this._documentListChild.getChildrenCache()
    );
    this._schemaChild = new SchemaTreeItem(
      this.collectionName,
      this.databaseName,
      this._dataService,
      this._schemaChild.isExpanded,
      this._schemaChild.hasClickedShowMoreFields,
      this._schemaChild.getChildrenCache()
    );
    return Promise.resolve([this._documentListChild, this._schemaChild]);
  }

  onDidCollapse(): void {
    this.isExpanded = false;
  }

  onDidExpand(): Promise<boolean> {
    this.isExpanded = true;

    return Promise.resolve(true);
  }

  resetCache(): void {
    this._documentListChild = new DocumentListTreeItem(
      this.collectionName,
      this.databaseName,
      this._type,
      this._dataService,
      false, // Collapsed.
      MAX_DOCUMENTS_VISIBLE,
      null // No existing cache.
    );
    this._schemaChild = new SchemaTreeItem(
      this.collectionName,
      this.databaseName,
      this._dataService,
      false, // Collapsed.
      false, // Show more fields has not been clicked.
      null // No existing cache.
    );
  }

  getDocumentListChild(): DocumentListTreeItem {
    return this._documentListChild;
  }
  getSchemaChild(): SchemaTreeItem {
    return this._schemaChild;
  }

  getMaxDocumentsToShow(): number {
    return this._documentListChild.getMaxDocumentsToShow();
  }

  async onDropCollectionClicked(): Promise<boolean> {
    const collectionName = this.collectionName;

    let inputtedCollectionName;
    try {
      inputtedCollectionName = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'e.g. myNewCollection',
        prompt: `Are you sure you wish to drop this collection? Enter the collection name '${collectionName}' to confirm.`,
        validateInput: (inputCollectionName: any) => {
          if (
            inputCollectionName &&
            !collectionName.startsWith(inputCollectionName)
          ) {
            return 'Collection name does not match';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.reject(
        new Error(`An error occured parsing the collection name: ${e}`)
      );
    }

    if (!inputtedCollectionName || collectionName !== inputtedCollectionName) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this._dataService.dropCollection(
        `${this.databaseName}.${collectionName}`,
        (err, successfullyDroppedCollection) => {
          if (err) {
            vscode.window.showErrorMessage(
              `Drop collection failed: ${err.message}`
            );
            return resolve(false);
          }

          return resolve(successfullyDroppedCollection);
        }
      );
    });
  }
}
