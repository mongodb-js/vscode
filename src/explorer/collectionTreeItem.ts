import * as vscode from 'vscode';
const path = require('path');

import DocumentListTreeItem, {
  CollectionTypes,
  MAX_DOCUMENTS_VISIBLE
} from './documentListTreeItem';
import IndexListTreeItem from './indexListTreeItem';
import TreeItemParent from './treeItemParentInterface';
import SchemaTreeItem from './schemaTreeItem';
import { getImagesPath } from '../extensionConstants';

export default class CollectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<CollectionTreeItem> {
  contextValue = 'collectionTreeItem';

  private _documentListChild: DocumentListTreeItem;
  private _schemaChild: SchemaTreeItem;
  private _indexListChild: IndexListTreeItem;

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
    existingSchemaChild?: SchemaTreeItem,
    existingIndexListChild?: IndexListTreeItem
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
        false // Collapsed.
      );
    this._indexListChild = existingIndexListChild
      ? existingIndexListChild
      : new IndexListTreeItem(
        this.collectionName,
        this.databaseName,
        this._dataService,
        false, // Collapsed.
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
    if (!this.isExpanded) {
      return Promise.resolve([]);
    }

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
      this._schemaChild
    );
    this._indexListChild = new IndexListTreeItem(
      this.collectionName,
      this.databaseName,
      this._dataService,
      this._indexListChild.isExpanded,
      this._indexListChild.getChildrenCache()
    );

    return Promise.resolve([
      this._documentListChild,
      this._schemaChild,
      this._indexListChild
    ]);
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
      false // Collapsed.
    );
  }

  getDocumentListChild(): DocumentListTreeItem {
    return this._documentListChild;
  }
  getSchemaChild(): SchemaTreeItem {
    return this._schemaChild;
  }
  getIndexListChild(): IndexListTreeItem {
    return this._indexListChild;
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
            return 'Collection name does not match.';
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

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(getImagesPath(), 'light');
    const DARK = path.join(getImagesPath(), 'dark');

    if (this._type === CollectionTypes.collection) {
      if (this.isExpanded) {
        return {
          light: path.join(LIGHT, 'collection-folder-open.svg'),
          dark: path.join(DARK, 'collection-folder-open.svg')
        };
      }
      return {
        light: path.join(LIGHT, 'collection-folder-closed.svg'),
        dark: path.join(DARK, 'collection-folder-closed.svg')
      };
    }
    return {
      light: path.join(LIGHT, 'view-folder.svg'),
      dark: path.join(DARK, 'view-folder.svg')
    };
  }
}
