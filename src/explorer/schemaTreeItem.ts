import * as vscode from 'vscode';
import parseSchema = require('mongodb-schema');
const path = require('path');

import { createLogger } from '../logging';
import TreeItemParent from './treeItemParentInterface';
import { MAX_DOCUMENTS_VISIBLE } from './documentListTreeItem';
import FieldTreeItem from './fieldTreeItem';
import { getImagesPath } from '../extensionConstants';

const log = createLogger('tree view document list');

const ITEM_LABEL = 'Schema';

export const FIELDS_TO_SHOW = 15;

class ShowAllFieldsTreeItem extends vscode.TreeItem {
  // This is the identifier we use to identify this tree item when a tree item
  // has been clicked. Activated from the explorer controller `onDidChangeSelection`.
  isShowMoreItem = true;
  onShowMoreClicked: () => void;

  constructor(showMore: () => void) {
    super('Show more fields...', vscode.TreeItemCollapsibleState.None);

    this.onShowMoreClicked = showMore;
    this.id = `${Math.random()}`;
  }
}

export default class SchemaTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<SchemaTreeItem> {
  childrenCacheIsUpToDate: boolean;
  childrenCache: { [fieldName: string]: FieldTreeItem };

  contextValue = 'schemaTreeItem';

  collectionName: string;
  databaseName: string;

  private _dataService: any;

  isExpanded: boolean;

  hasClickedShowMoreFields: boolean;
  hasMoreFieldsToShow: boolean;

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: any,
    isExpanded: boolean,
    cachedSchemaTreeItem?: SchemaTreeItem
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

    if (cachedSchemaTreeItem) {
      this.hasClickedShowMoreFields =
        cachedSchemaTreeItem.hasClickedShowMoreFields;
      this.hasMoreFieldsToShow = cachedSchemaTreeItem.hasMoreFieldsToShow;

      this.childrenCache = cachedSchemaTreeItem.childrenCache;
      this.childrenCacheIsUpToDate =
        cachedSchemaTreeItem.childrenCacheIsUpToDate;
    } else {
      // No existing cache to pull from, default values.
      this.hasClickedShowMoreFields = false;
      this.hasMoreFieldsToShow = false;

      this.childrenCache = {};
      this.childrenCacheIsUpToDate = false;
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

    if (this.childrenCacheIsUpToDate) {
      if (!this.hasClickedShowMoreFields && this.hasMoreFieldsToShow) {
        return Promise.resolve([
          ...Object.values(this.childrenCache).map(
            (cachedField) =>
              new FieldTreeItem(
                cachedField.field,
                cachedField.isExpanded,
                cachedField.getChildrenCache()
              )
          ),
          new ShowAllFieldsTreeItem(() => this.onShowMoreClicked())
        ]);
      }

      return Promise.resolve(
        Object.values(this.childrenCache).map(
          (cachedField) =>
            new FieldTreeItem(
              cachedField.field,
              cachedField.isExpanded,
              cachedField.getChildrenCache()
            )
        )
      );
    }

    return new Promise((resolve, reject) => {
      const namespace = `${this.databaseName}.${this.collectionName}`;

      log.info(`parsing schema for namespace ${namespace}`);

      this._dataService.find(
        namespace,
        {
          /* No filter */
        },
        {
          limit: MAX_DOCUMENTS_VISIBLE
        },
        (findError: Error | undefined, documents: []) => {
          if (findError) {
            vscode.window.showErrorMessage(
              `Unable to list documents: ${findError}`
            );
            return reject(new Error(`Unable to list documents: ${findError}`));
          }

          if (!documents || documents.length === 0) {
            vscode.window.showInformationMessage(
              'No documents were found when attempting to parse schema.'
            );
            this.childrenCacheIsUpToDate = true;
            this.childrenCache = {};
            return resolve([]);
          }

          parseSchema(documents, (parseError: Error | undefined, schema) => {
            this.childrenCacheIsUpToDate = true;

            if (parseError) {
              vscode.window.showErrorMessage(
                `Unable to parse schema: ${parseError.message}`
              );
              this.childrenCache = {};
              return resolve([]);
            }

            if (!schema) {
              this.childrenCache = {};
              return resolve([]);
            }

            const pastChildrenCache = this.childrenCache;
            this.childrenCache = {};

            const fieldsToShow = this.hasClickedShowMoreFields
              ? schema.fields.length
              : Math.min(FIELDS_TO_SHOW, schema.fields.length);

            for (let i = 0; i < fieldsToShow; i++) {
              if (pastChildrenCache[schema.fields[i].name]) {
                // Use the past cached field item.
                this.childrenCache[schema.fields[i].name] = new FieldTreeItem(
                  schema.fields[i],
                  pastChildrenCache[schema.fields[i].name].isExpanded,
                  pastChildrenCache[schema.fields[i].name].getChildrenCache()
                );
              } else {
                this.childrenCache[schema.fields[i].name] = new FieldTreeItem(
                  schema.fields[i],
                  false, // Not expanded.
                  {} // No past cache.
                );
              }
            }

            // Add a clickable show more option when a schema has more
            // fields than the default amount we show.
            if (
              !this.hasClickedShowMoreFields &&
              schema.fields.length > FIELDS_TO_SHOW
            ) {
              this.hasMoreFieldsToShow = true;
              return resolve([
                ...Object.values(this.childrenCache),
                new ShowAllFieldsTreeItem(() => this.onShowMoreClicked())
              ]);
            }

            return resolve(Object.values(this.childrenCache));
          });
        }
      );
    });
  }

  onShowMoreClicked(): void {
    log.info(
      `show more schema fields clicked for namespace ${this.databaseName}.${this.collectionName}`
    );

    this.childrenCacheIsUpToDate = false;
    this.hasClickedShowMoreFields = true;
  }

  onDidCollapse(): void {
    this.isExpanded = false;
  }

  onDidExpand(): Promise<boolean> {
    this.isExpanded = true;

    return Promise.resolve(true);
  }

  resetCache(): void {
    this.childrenCache = {};
    this.childrenCacheIsUpToDate = false;
  }

  get iconPath():
    | string
    | vscode.Uri
    | { light: string | vscode.Uri; dark: string | vscode.Uri } {
    const LIGHT = path.join(getImagesPath(), 'light');
    const DARK = path.join(getImagesPath(), 'dark');

    return {
      light: path.join(LIGHT, 'schema.svg'),
      dark: path.join(DARK, 'schema.svg')
    };
  }
}
