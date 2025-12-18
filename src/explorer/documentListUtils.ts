import * as vscode from 'vscode';
import numeral from 'numeral';
import path from 'path';

import { getImagesPath } from '../extensionConstants';

export const CollectionType = {
  collection: 'collection',
  view: 'view',
  timeseries: 'timeseries',
} as const;

export type CollectionType =
  (typeof CollectionType)[keyof typeof CollectionType];

export const formatDocCount = (count: number): string => {
  // We format the count (30000 -> 30k) and then display it uppercase (30K).
  return `${numeral(count).format('0a') as string}`.toUpperCase();
};

export function getDocumentsIconPath(): { light: vscode.Uri; dark: vscode.Uri } {
  const LIGHT = path.join(getImagesPath(), 'light');
  const DARK = path.join(getImagesPath(), 'dark');

  return {
    light: vscode.Uri.file(path.join(LIGHT, 'documents.svg')),
    dark: vscode.Uri.file(path.join(DARK, 'documents.svg')),
  };
}

export function getDocumentsTooltip(
  type: string,
  documentCount: number | null,
): string {
  const typeString = type === CollectionType.view ? 'View' : 'Collection';
  if (documentCount !== null) {
    return `${typeString} Documents - ${documentCount}`;
  }
  return `${typeString} Documents`;
}

