import * as vscode from 'vscode';
import path from 'path';
import type { DataService } from 'mongodb-data-service';

import DocumentListTreeItem, {
  CollectionType,
  MAX_DOCUMENTS_VISIBLE,
} from './documentListTreeItem';
import formatError from '../utils/formatError';
import { getImagesPath } from '../extensionConstants';
import IndexListTreeItem from './indexListTreeItem';
import type TreeItemParent from './treeItemParentInterface';
import SchemaTreeItem from './schemaTreeItem';

function getIconPath(
  type: string,
  isExpanded: boolean,
): { light: vscode.Uri; dark: vscode.Uri } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  if (type === CollectionType.timeseries) {
    return {
      light: vscode.Uri.file(path.join(LIGHT, 'collection-timeseries.svg')),
      dark: vscode.Uri.file(path.join(DARK, 'collection-timeseries.svg')),
    };
  } else if (type === CollectionType.collection) {
    if (isExpanded) {
      return {
        light: vscode.Uri.file(path.join(LIGHT, 'collection-folder-open.svg')),
        dark: vscode.Uri.file(path.join(DARK, 'collection-folder-open.svg')),
      };
    }
    return {
      light: vscode.Uri.file(path.join(LIGHT, 'collection-folder-closed.svg')),
      dark: vscode.Uri.file(path.join(DARK, 'collection-folder-closed.svg')),
    };
  }
  return {
    light: vscode.Uri.file(path.join(LIGHT, 'view-folder.svg')),
    dark: vscode.Uri.file(path.join(DARK, 'view-folder.svg')),
  };
}

export type CollectionDetailsType = Awaited<
  ReturnType<DataService['listCollections']>
>[number];

function isChildCacheOutOfSync(
  child: DocumentListTreeItem | SchemaTreeItem | IndexListTreeItem,
): boolean {
  const isExpanded = child.isExpanded;
  const collapsibleState = child.collapsibleState;
  return isExpanded
    ? collapsibleState !== vscode.TreeItemCollapsibleState.Expanded
    : collapsibleState !== vscode.TreeItemCollapsibleState.Collapsed;
}

export default class CollectionTreeItem
  extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<CollectionTreeItem>
{
  contextValue = 'collectionTreeItem' as const;

  private _documentListChild: DocumentListTreeItem;
  private _schemaChild: SchemaTreeItem;
  private _indexListChild: IndexListTreeItem;

  collection: CollectionDetailsType;
  collectionName: string;
  databaseName: string;
  namespace: string;

  private _dataService: DataService;
  private _type: string;
  documentCount: number | null = null;

  isExpanded: boolean;

  cacheIsUpToDate = false;

  isDropped = false;

  iconPath: { light: vscode.Uri; dark: vscode.Uri };

  constructor({
    collection,
    databaseName,
    dataService,
    isExpanded,
    cacheIsUpToDate,
    cachedDocumentCount,
    existingDocumentListChild,
    existingSchemaChild,
    existingIndexListChild,
  }: {
    collection: CollectionDetailsType;
    databaseName: string;
    dataService: DataService;
    isExpanded: boolean;
    cacheIsUpToDate: boolean;
    cachedDocumentCount: number | null;
    existingDocumentListChild?: DocumentListTreeItem;
    existingSchemaChild?: SchemaTreeItem;
    existingIndexListChild?: IndexListTreeItem;
  }) {
    super(
      collection.name,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );

    this.collection = collection;
    this.collectionName = collection.name;
    this.databaseName = databaseName;
    this.namespace = `${this.databaseName}.${this.collectionName}`;
    this._type = collection.type; // Type can be `collection` or `view`.
    this._dataService = dataService;
    this.isExpanded = isExpanded;
    this.documentCount = cachedDocumentCount;
    this.cacheIsUpToDate = cacheIsUpToDate;
    this._documentListChild = existingDocumentListChild
      ? existingDocumentListChild
      : new DocumentListTreeItem({
          collectionName: this.collectionName,
          databaseName: this.databaseName,
          type: this._type,
          dataService: this._dataService,
          isExpanded: false,
          maxDocumentsToShow: MAX_DOCUMENTS_VISIBLE,
          cachedDocumentCount: this.documentCount,
          refreshDocumentCount: this.refreshDocumentCount,
          cacheIsUpToDate: false,
          childrenCache: [], // Empty cache.
        });
    this._schemaChild = existingSchemaChild
      ? existingSchemaChild
      : new SchemaTreeItem({
          collectionName: this.collectionName,
          databaseName: this.databaseName,
          dataService: this._dataService,
          isExpanded: false,
          hasClickedShowMoreFields: false,
          hasMoreFieldsToShow: false,
          cacheIsUpToDate: false,
          childrenCache: {}, // Empty cache.
        });
    this._indexListChild = existingIndexListChild
      ? existingIndexListChild
      : new IndexListTreeItem({
          collectionName: this.collectionName,
          databaseName: this.databaseName,
          dataService: this._dataService,
          isExpanded: false,
          cacheIsUpToDate: false,
          childrenCache: [], // Empty cache.
        });

    this.tooltip =
      collection.type === CollectionType.view
        ? 'Read only view'
        : collection.name;
    this.iconPath = getIconPath(collection.type, isExpanded);
  }

  getTreeItem(element: CollectionTreeItem): CollectionTreeItem {
    return element;
  }

  async getChildren(): Promise<any[]> {
    if (!this.isExpanded) {
      return [];
    }

    if (this.documentCount === null) {
      await this.refreshDocumentCount();
    }

    // Update cache if one of the children has been expanded/collapsed.
    if (this.needsToUpdateCache()) {
      this.cacheIsUpToDate = false;
    }

    if (this.cacheIsUpToDate) {
      return [this._documentListChild, this._schemaChild, this._indexListChild];
    }

    this.cacheIsUpToDate = true;

    // We rebuild the children here so their controlled `expanded` state
    // is ensure to be set by vscode.
    this.rebuildChildrenCache();

    return [this._documentListChild, this._schemaChild, this._indexListChild];
  }

  rebuildDocumentListTreeItem(): void {
    this._documentListChild = new DocumentListTreeItem({
      collectionName: this.collectionName,
      databaseName: this.databaseName,
      type: this._type,
      dataService: this._dataService,
      isExpanded: this._documentListChild.isExpanded,
      maxDocumentsToShow: this._documentListChild.getMaxDocumentsToShow(),
      cachedDocumentCount: this.documentCount,
      refreshDocumentCount: this.refreshDocumentCount,
      cacheIsUpToDate: this._documentListChild.cacheIsUpToDate,
      childrenCache: this._documentListChild.getChildrenCache(),
    });
  }

  rebuildSchemaTreeItem(): void {
    this._schemaChild = new SchemaTreeItem({
      collectionName: this.collectionName,
      databaseName: this.databaseName,
      dataService: this._dataService,
      isExpanded: this._schemaChild.isExpanded,
      hasClickedShowMoreFields: this._schemaChild.hasClickedShowMoreFields,
      hasMoreFieldsToShow: this._schemaChild.hasMoreFieldsToShow,
      cacheIsUpToDate: this._schemaChild.cacheIsUpToDate,
      childrenCache: this._schemaChild.childrenCache,
    });
  }

  rebuildIndexListTreeItem(): void {
    this._indexListChild = new IndexListTreeItem({
      collectionName: this.collectionName,
      databaseName: this.databaseName,
      dataService: this._dataService,
      isExpanded: this._indexListChild.isExpanded,
      cacheIsUpToDate: this._indexListChild.cacheIsUpToDate,
      childrenCache: this._indexListChild.getChildrenCache(),
    });
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

  async onDidExpand(): Promise<boolean> {
    this.isExpanded = true;
    this.cacheIsUpToDate = false;

    await this.refreshDocumentCount();

    return true;
  }

  resetCache(): void {
    this.cacheIsUpToDate = false;
    this.documentCount = null;

    this._documentListChild = new DocumentListTreeItem({
      collectionName: this.collectionName,
      databaseName: this.databaseName,
      type: this._type,
      dataService: this._dataService,
      isExpanded: false,
      maxDocumentsToShow: MAX_DOCUMENTS_VISIBLE,
      cachedDocumentCount: this.documentCount,
      refreshDocumentCount: this.refreshDocumentCount,
      cacheIsUpToDate: false,
      childrenCache: [], // Empty cache.
    });
    this._schemaChild = new SchemaTreeItem({
      collectionName: this.collectionName,
      databaseName: this.databaseName,
      dataService: this._dataService,
      isExpanded: false,
      hasClickedShowMoreFields: false,
      hasMoreFieldsToShow: false,
      cacheIsUpToDate: false,
      childrenCache: {}, // Empty cache.
    });
    this._indexListChild = new IndexListTreeItem({
      collectionName: this.collectionName,
      databaseName: this.databaseName,
      dataService: this._dataService,
      isExpanded: false,
      cacheIsUpToDate: false,
      childrenCache: [], // Empty cache.
    });
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

  refreshDocumentCount = async (): Promise<number> => {
    // Skip the count on views and time-series collections since it will error.
    if (
      this._type === CollectionType.view ||
      this._type === CollectionType.timeseries
    ) {
      this.documentCount = null;
      return 0;
    }

    try {
      // We fetch the document when we expand in order to show
      // the document count in the document list tree item `description`.
      this.documentCount = await this._dataService.estimatedCount(
        this.namespace,
        {}, // No options.
        undefined,
      );

      return this.documentCount;
    } catch (err) {
      this.documentCount = null;
      return 0;
    }
  };

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
        },
      });
    } catch (error) {
      return Promise.reject(
        new Error(`An error occurred parsing the collection name: ${error}`),
      );
    }

    if (!inputtedCollectionName || collectionName !== inputtedCollectionName) {
      return Promise.resolve(false);
    }

    try {
      const successfullyDroppedCollection =
        await this._dataService.dropCollection(
          `${this.databaseName}.${collectionName}`,
        );

      this.isDropped = successfullyDroppedCollection;

      return successfullyDroppedCollection;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Drop collection failed: ${formatError(error).message}`,
      );

      return false;
    }
  }
}
