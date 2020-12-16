import * as vscode from 'vscode';
import * as parseSchema from 'mongodb-schema';
import * as path from 'path';

import { createLogger } from '../logging';
import TreeItemParent from './treeItemParentInterface';
import { MAX_DOCUMENTS_VISIBLE } from './documentListTreeItem';
import FieldTreeItem from './fieldTreeItem';
import { getImagesPath } from '../extensionConstants';
import { MongoClient } from 'mongodb';

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

function getIconPath(): { light: string; dark: string } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: path.join(LIGHT, 'schema.svg'),
    dark: path.join(DARK, 'schema.svg')
  };
}

export default class SchemaTreeItem extends vscode.TreeItem
  implements TreeItemParent, vscode.TreeDataProvider<SchemaTreeItem> {
  cacheIsUpToDate: boolean;
  childrenCache: { [fieldName: string]: FieldTreeItem };

  contextValue = 'schemaTreeItem';

  collectionName: string;
  databaseName: string;

  private _dataService: MongoClient;

  isExpanded: boolean;

  hasClickedShowMoreFields: boolean;
  hasMoreFieldsToShow: boolean;

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: MongoClient,
    isExpanded: boolean,
    hasClickedShowMoreFields: boolean,
    hasMoreFieldsToShow: boolean,
    cacheIsUpToDate: boolean,
    childrenCache: { [fieldName: string]: FieldTreeItem }
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

    this.hasClickedShowMoreFields = hasClickedShowMoreFields;
    this.hasMoreFieldsToShow = hasMoreFieldsToShow;
    this.childrenCache = childrenCache;
    this.cacheIsUpToDate = cacheIsUpToDate;

    this.iconPath = getIconPath();
    this.tooltip = 'Derived Document Schema';
  }

  getTreeItem(element: SchemaTreeItem): SchemaTreeItem {
    return element;
  }

  async fetchDocumentsForSchema(): Promise<any[]> {
    try {
      const documents = await this._dataService
        .db(this.databaseName)
        .collection(this.collectionName)
        .find({
          /* No filter */
        }).limit(MAX_DOCUMENTS_VISIBLE).toArray();

      return documents;
    } catch (error) {
      return Promise.reject(new Error(`Unable to list documents: ${error}`));
    }
  }

  async getSchema(): Promise<any[]> {
    let documents;
    try {
      documents = await this.fetchDocumentsForSchema();
    } catch (err) {
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      const namespace = `${this.databaseName}.${this.collectionName}`;

      log.info(`parsing schema for namespace ${namespace}`);
      if (!documents || documents.length === 0) {
        return resolve([]);
      }

      parseSchema(documents, (parseError: Error | undefined, schema) => {
        if (parseError) {
          return reject(
            new Error(`Unable to parse schema: ${parseError.message}`)
          );
        }

        return resolve(schema);
      });
    });
  }

  buildFieldTreeItemsFromSchema(schema: any): any {
    const currentCache = this.childrenCache;
    const newFieldTreeItems = {};

    const fieldsToShow = this.hasClickedShowMoreFields
      ? schema.fields.length
      : Math.min(FIELDS_TO_SHOW, schema.fields.length);

    for (let i = 0; i < fieldsToShow; i++) {
      if (currentCache[schema.fields[i].name]) {
        // Use the past cached field item.
        newFieldTreeItems[schema.fields[i].name] = new FieldTreeItem(
          schema.fields[i],
          currentCache[schema.fields[i].name].isExpanded,
          currentCache[schema.fields[i].name].getChildrenCache()
        );
      } else {
        newFieldTreeItems[schema.fields[i].name] = new FieldTreeItem(
          schema.fields[i],
          false, // Not expanded.
          {} // No past cache.
        );
      }
    }

    return newFieldTreeItems;
  }

  // Returns an array of FieldTreeItem which are the fields in the
  // collection's schema
  async getChildren(): Promise<any[]> {
    if (!this.isExpanded) {
      return [];
    }

    if (this.cacheIsUpToDate) {
      const pastChildrenCache = this.childrenCache;
      this.childrenCache = {};

      // We manually rebuild each node to ensure we update the expanded state.
      Object.keys(pastChildrenCache).forEach((fieldName) => {
        this.childrenCache[fieldName] = new FieldTreeItem(
          pastChildrenCache[fieldName].field,
          pastChildrenCache[fieldName].isExpanded,
          pastChildrenCache[fieldName].getChildrenCache()
        );
      });

      if (!this.hasClickedShowMoreFields && this.hasMoreFieldsToShow) {
        return [
          ...Object.values(this.childrenCache),
          new ShowAllFieldsTreeItem(() => this.onShowMoreClicked())
        ];
      }

      return Object.values(this.childrenCache);
    }

    let schema;

    try {
      schema = await this.getSchema();
    } catch (err) {
      return Promise.reject(err);
    }

    this.cacheIsUpToDate = true;

    if (!schema || !schema.fields || schema.fields.length < 1) {
      vscode.window.showInformationMessage(
        'No documents were found when attempting to parse schema.'
      );
      this.childrenCache = {};
      return [];
    }

    this.childrenCache = this.buildFieldTreeItemsFromSchema(schema);

    // Add a clickable show more option when a schema has more
    // fields than the default amount we show.
    if (
      !this.hasClickedShowMoreFields &&
      schema.fields.length > FIELDS_TO_SHOW
    ) {
      this.hasMoreFieldsToShow = true;
      return [
        ...Object.values(this.childrenCache),
        new ShowAllFieldsTreeItem(() => this.onShowMoreClicked())
      ];
    }

    return Object.values(this.childrenCache);
  }

  onShowMoreClicked(): void {
    log.info(
      `show more schema fields clicked for namespace ${this.databaseName}.${this.collectionName}`
    );

    this.cacheIsUpToDate = false;
    this.hasClickedShowMoreFields = true;
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
    this.childrenCache = {};
    this.cacheIsUpToDate = false;
  }
}
