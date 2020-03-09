import * as vscode from 'vscode';

const parseSchema = require('mongodb-schema');

import { createLogger } from '../logging';
import TreeItemParent from './treeItemParentInterface';
import { MAX_DOCUMENTS_VISIBLE } from './documentListTreeItem';

const ITEM_LABEL = 'Schema';

const log = createLogger('tree view document list');

export default class SchemaTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<SchemaTreeItem> {
  _childrenCacheIsUpToDate = false;
  private _childrenCache: vscode.TreeItem[] = [];

  contextValue = 'schemaTreeItem';

  collectionName: string;
  databaseName: string;

  private _dataService: any;

  isExpanded: boolean;

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    existingCache: vscode.TreeItem[] | null
  ) {
    super(
      ITEM_LABEL,
      isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.collectionName = collectionName;
    this.databaseName = databaseName;

    this._dataService = dataService;

    this.isExpanded = isExpanded;

    if (existingCache !== null) {
      this._childrenCache = existingCache;
      this._childrenCacheIsUpToDate = true;
    }
  }

  get tooltip(): string {
    return 'Derived Document Schema';
  }

  getTreeItem(element: SchemaTreeItem): SchemaTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    if (!this.isExpanded) {
      return Promise.resolve([]);
    }

    if (this._childrenCacheIsUpToDate) {
      return Promise.resolve(this._childrenCache);
    }

    return new Promise((resolve, reject) => {
      const namespace = `${this.databaseName}.${this.collectionName}`;

      log.info(`parsing schema for namespace ${namespace}`);

      this._childrenCacheIsUpToDate = true;

      this._dataService.find(
        namespace,
        { /* No filter */ },
        {
          limit: MAX_DOCUMENTS_VISIBLE
        },
        (findError: Error | undefined, documents: []) => {
          if (findError) {
            vscode.window.showErrorMessage(`Unable to list documents: ${findError}`);
            return reject(`Unable to list documents: ${findError}`);
          }

          this._childrenCacheIsUpToDate = true;

          if (!documents || documents.length === 0) {
            vscode.window.showInformationMessage('No documents were found when attempting to parse schema.');
            this._childrenCache = [];
            return resolve(this._childrenCache);
          }

          parseSchema(documents, (parseError: Error | undefined, schema) => {
            if (parseError) {
              vscode.window.showErrorMessage(`Unable to parse schema: ${parseError.message}`);
              return reject(`Unable to parse schema: ${parseError.message}`);
            }

            console.log('Got schema.');
            // console.log(JSON.stringify(schema, null, 2));
            return resolve(this._childrenCache);
          });
        }
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
