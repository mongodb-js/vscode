import * as vscode from 'vscode';

import type { DataService } from 'mongodb-data-service';
import {
  CollectionType,
  formatDocCount,
  getDocumentsIconPath,
  getDocumentsTooltip,
} from './documentListUtils';
import formatError from '../utils/formatError';

export const PREVIEW_LIST_ITEM = 'documentListPreviewItem';

export default class ShowPreviewTreeItem extends vscode.TreeItem {
  cacheIsUpToDate = false;
  contextValue = PREVIEW_LIST_ITEM;

  refreshDocumentCount: () => Promise<number>;

  _documentCount: number | null;
  private _maxDocumentsToShow: number;

  collectionName: string;
  databaseName: string;
  namespace: string;
  type: string;

  private _dataService: DataService;

  iconPath: { light: vscode.Uri; dark: vscode.Uri };

  constructor({
    collectionName,
    databaseName,
    type,
    dataService,
    maxDocumentsToShow,
    cachedDocumentCount,
    refreshDocumentCount,
    cacheIsUpToDate,
  }: {
    collectionName: string;
    databaseName: string;
    type: string;
    dataService: DataService;
    maxDocumentsToShow: number;
    cachedDocumentCount: number | null;
    refreshDocumentCount: () => Promise<number>;
    cacheIsUpToDate: boolean;
  }) {
    super('Documents', vscode.TreeItemCollapsibleState.None);
    this.id = `documents-preview-${Math.random()}`;

    this.collectionName = collectionName;
    this.databaseName = databaseName;
    this.namespace = `${this.databaseName}.${this.collectionName}`;

    this.type = type; // Type can be `collection` or `view`.
    this._dataService = dataService;

    this._maxDocumentsToShow = maxDocumentsToShow;
    this._documentCount = cachedDocumentCount;

    this.refreshDocumentCount = refreshDocumentCount;

    this.cacheIsUpToDate = cacheIsUpToDate;

    if (this._documentCount !== null) {
      this.description = formatDocCount(this._documentCount);
    }

    this.iconPath = getDocumentsIconPath();
    this.tooltip = getDocumentsTooltip(type, cachedDocumentCount);
  }

  async loadPreview(options?: {
    sort?: 'default' | 'asc' | 'desc';
    limit?: number;
  }): Promise<any[]> {
    if (this.type === CollectionType.view) {
      return [];
    }

    this.cacheIsUpToDate = true;
    let documents;

    try {
      const findOptions: { limit: number; sort?: { _id: 1 | -1 } } = {
        limit: options?.limit ?? this._maxDocumentsToShow,
      };

      // Add sort if specified (not 'default')
      if (options?.sort === 'asc') {
        findOptions.sort = { _id: 1 };
      } else if (options?.sort === 'desc') {
        findOptions.sort = { _id: -1 };
      }

      documents = await this._dataService.find(
        this.namespace,
        {}, // No filter.
        findOptions,
      );
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Fetch documents failed: ${formatError(error).message}`,
      );
      return [];
    }

    return documents;
  }

  async getTotalCount(): Promise<number> {
    if (
      this.type === CollectionType.view ||
      this.type === CollectionType.timeseries
    ) {
      return 0;
    }

    try {
      const count = await this._dataService.estimatedCount(
        this.namespace,
        {},
        undefined,
      );
      return count;
    } catch (error) {
      return 0;
    }
  }
}
