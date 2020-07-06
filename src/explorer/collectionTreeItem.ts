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

type CollectionModelType = {
  name: string;
  type: CollectionTypes;
};

function isChildCacheOutOfSync(
  child: DocumentListTreeItem | SchemaTreeItem | IndexListTreeItem
): boolean {
  const isExpanded = child.isExpanded;
  const collapsibleState = child.collapsibleState;
  return isExpanded
    ? collapsibleState !== vscode.TreeItemCollapsibleState.Expanded
    : collapsibleState !== vscode.TreeItemCollapsibleState.Collapsed;
}

export default class CollectionTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<CollectionTreeItem> {
  contextValue = 'collectionTreeItem';

  private _documentListChild: DocumentListTreeItem;
  private _schemaChild: SchemaTreeItem;
  private _indexListChild: IndexListTreeItem;

  collection: CollectionModelType;
  collectionName: string;
  databaseName: string;

  private _dataService: any;
  private _type: CollectionTypes;

  isExpanded: boolean;

  cacheIsUpToDate = false;

  constructor(
    collection: CollectionModelType,
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    cacheIsUpToDate: boolean,
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

    this.collection = collection;
    this.collectionName = collection.name;
    this.databaseName = databaseName;

    this._type = collection.type; // Type can be `collection` or `view`.
    this._dataService = dataService;

    this.isExpanded = isExpanded;

    this.cacheIsUpToDate = cacheIsUpToDate;

    this._documentListChild = existingDocumentListChild
      ? existingDocumentListChild
      : new DocumentListTreeItem(
        this.collectionName,
        this.databaseName,
        this._type,
        this._dataService,
        false,
        MAX_DOCUMENTS_VISIBLE,
        false,
        false,
        []
      );
    this._schemaChild = existingSchemaChild
      ? existingSchemaChild
      : new SchemaTreeItem(
        this.collectionName,
        this.databaseName,
        this._dataService,
        false,
        false,
        false,
        false,
        {}
      );
    this._indexListChild = existingIndexListChild
      ? existingIndexListChild
      : new IndexListTreeItem(
        this.collectionName,
        this.databaseName,
        this._dataService,
        false,
        false,
        []
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

    // Update cache if one of the children has been expanded/collapsed.
    if (this.needsToUpdateCache()) {
      this.cacheIsUpToDate = false;
    }

    if (this.cacheIsUpToDate) {
      return Promise.resolve([
        this._documentListChild,
        this._schemaChild,
        this._indexListChild
      ]);
    }

    this.cacheIsUpToDate = true;

    // We rebuild the children here so their controlled `expanded` state
    // is ensure to be set by vscode.
    this.rebuildChildrenCache();

    return Promise.resolve([
      this._documentListChild,
      this._schemaChild,
      this._indexListChild
    ]);
  }

  rebuildDocumentListTreeItem(): void {
    this._documentListChild = new DocumentListTreeItem(
      this.collectionName,
      this.databaseName,
      this._type,
      this._dataService,
      this._documentListChild.isExpanded,
      this._documentListChild.getMaxDocumentsToShow(),
      this._documentListChild.hasMoreDocumentsToShow,
      this._documentListChild.cacheIsUpToDate,
      this._documentListChild.getChildrenCache()
    );
  }

  rebuildSchemaTreeItem(): void {
    this._schemaChild = new SchemaTreeItem(
      this.collectionName,
      this.databaseName,
      this._dataService,
      this._schemaChild.isExpanded,
      this._schemaChild.hasClickedShowMoreFields,
      this._schemaChild.hasMoreFieldsToShow,
      this._schemaChild.cacheIsUpToDate,
      this._schemaChild.childrenCache
    );
  }

  rebuildIndexListTreeItem(): void {
    this._indexListChild = new IndexListTreeItem(
      this.collectionName,
      this.databaseName,
      this._dataService,
      this._indexListChild.isExpanded,
      this._indexListChild.cacheIsUpToDate,
      this._indexListChild.getChildrenCache()
    );
  }

  rebuildChildrenCache(): void {
    // We rebuild the children here so their controlled `expanded` state
    // is ensure to be set by vscode.
    this.rebuildDocumentListTreeItem();
    this.rebuildSchemaTreeItem();
    this.rebuildIndexListTreeItem();
  }

  needsToUpdateCache(): boolean {
    return (
      isChildCacheOutOfSync(this._documentListChild) ||
      isChildCacheOutOfSync(this._schemaChild) ||
      isChildCacheOutOfSync(this._indexListChild)
    );
  }

  onDidCollapse(): void {
    this.isExpanded = false;
    this.cacheIsUpToDate = false;
  }

  onDidExpand(): Promise<boolean> {
    this.isExpanded = true;
    this.cacheIsUpToDate = false;

    return Promise.resolve(true);
  }

  resetCache(): void {
    this.cacheIsUpToDate = false;

    this._documentListChild = new DocumentListTreeItem(
      this.collectionName,
      this.databaseName,
      this._type,
      this._dataService,
      false,
      MAX_DOCUMENTS_VISIBLE,
      false,
      false,
      []
    );
    this._schemaChild = new SchemaTreeItem(
      this.collectionName,
      this.databaseName,
      this._dataService,
      false,
      false,
      false,
      false,
      {}
    );
    this._indexListChild = new IndexListTreeItem(
      this.collectionName,
      this.databaseName,
      this._dataService,
      false,
      false,
      []
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
    if (!this._documentListChild) {
      return MAX_DOCUMENTS_VISIBLE;
    }

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
