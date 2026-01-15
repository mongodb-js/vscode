import * as vscode from 'vscode';

import { CollectionType, formatDocCount } from './documentUtils';
import path from 'path';
import { getImagesPath } from '../extensionConstants';

export const PREVIEW_LIST_ITEM = 'documentPreviewItem';

export default class ShowPreviewTreeItem extends vscode.TreeItem {
  cacheIsUpToDate = false;
  contextValue = PREVIEW_LIST_ITEM;

  refreshDocumentCount: () => Promise<number>;

  _documentCount: number | null;

  collectionName: string;
  databaseName: string;
  namespace: string;
  type: string;

  iconPath: { light: vscode.Uri; dark: vscode.Uri };

  constructor({
    collectionName,
    databaseName,
    type,
    cachedDocumentCount,
    refreshDocumentCount,
    cacheIsUpToDate,
  }: {
    collectionName: string;
    databaseName: string;
    type: string;
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
    this._documentCount = cachedDocumentCount;

    this.refreshDocumentCount = refreshDocumentCount;

    this.cacheIsUpToDate = cacheIsUpToDate;

    if (this._documentCount !== null) {
      this.description = formatDocCount(this._documentCount);
    }

    this.iconPath = getIconPath();
    this.tooltip = getTooltip(type, cachedDocumentCount);
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
