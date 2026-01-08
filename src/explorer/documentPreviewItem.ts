import * as vscode from 'vscode';

import type { DataService } from 'mongodb-data-service';
import { CollectionType, formatDocCount } from './documentUtils';
import path from 'path';
import { getImagesPath } from '../extensionConstants';
import formatError from '../utils/formatError';

export const PREVIEW_LIST_ITEM = 'documentPreviewItem';

export default class ShowPreviewTreeItem extends vscode.TreeItem {
  cacheIsUpToDate = false;
  contextValue = PREVIEW_LIST_ITEM;

  refreshDocumentCount: () => Promise<number>;

  _documentCount: number | null;
  _maxDocumentsToShow: number;

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
    cachedDocumentCount,
    maxDocumentsToShow,
    refreshDocumentCount,
    cacheIsUpToDate,
  }: {
    collectionName: string;
    databaseName: string;
    type: string;
    dataService: DataService;
    cachedDocumentCount: number | null;
    maxDocumentsToShow: number;
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
    this._documentCount = cachedDocumentCount;
    this._maxDocumentsToShow = maxDocumentsToShow;

    this.refreshDocumentCount = refreshDocumentCount;

    this.cacheIsUpToDate = cacheIsUpToDate;

    if (this._documentCount !== null) {
      this.description = formatDocCount(this._documentCount);
    }

    this.iconPath = getIconPath();
    this.tooltip = getTooltip(type, cachedDocumentCount);
  }

  async loadPreview(options?: {
    sort?: 'default' | 'asc' | 'desc';
    limit?: number;
    signal?: AbortSignal;
  }): Promise<any[]> {
    if (this.type === CollectionType.view) {
      return [];
    }

    this.cacheIsUpToDate = true;
    let documents;

    try {
      const findOptions: {
        limit: number;
        sort?: { _id: 1 | -1 };
      } = {
        limit: options?.limit ?? this._maxDocumentsToShow,
      };

      // Add sort if specified (not 'default')
      if (options?.sort === 'asc') {
        findOptions.sort = { _id: 1 };
      } else if (options?.sort === 'desc') {
        findOptions.sort = { _id: -1 };
      }

      // Pass abortSignal for cancellation support via executionOptions.
      const executionOptions = options?.signal
        ? { abortSignal: options.signal }
        : undefined;

      documents = await this._dataService.find(
        this.namespace,
        {}, // No filter.
        findOptions,
        executionOptions,
      );
    } catch (error) {
      // Don't show error message if the request was aborted.
      if (options?.signal?.aborted) {
        return [];
      }
      void vscode.window.showErrorMessage(
        `Fetch documents failed: ${formatError(error).message}`,
      );
      return [];
    }

    return documents;
  }

  async getTotalCount(signal?: AbortSignal): Promise<number> {
    if (
      this.type === CollectionType.view ||
      this.type === CollectionType.timeseries
    ) {
      return 0;
    }

    try {
      // Pass abortSignal for cancellation support via executionOptions.
      const executionOptions = signal ? { abortSignal: signal } : undefined;

      const count = await this._dataService.estimatedCount(
        this.namespace,
        {},
        executionOptions,
      );
      return count;
    } catch (error) {
      // Return 0 silently if aborted or on error.
      return 0;
    }
  }
}

function getIconPath(): { light: vscode.Uri; dark: vscode.Uri } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: vscode.Uri.file(path.join(LIGHT, 'documents.svg')),
    dark: vscode.Uri.file(path.join(DARK, 'documents.svg')),
  };
}

function getTooltip(type: string, documentCount: number | null): string {
  const typeString = type === CollectionType.view ? 'View' : 'Collection';
  if (documentCount !== null) {
    return `${typeString} Documents - ${documentCount}`;
  }
  return `${typeString} Documents`;
}
