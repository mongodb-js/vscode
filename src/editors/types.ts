import * as vscode from 'vscode';
import {
  SORT_VALUE_MAP,
  type DocumentSort,
  type SortValueKey,
} from '../views/data-browsing-app/extension-app-message-constants';

export type DocumentViewAndEditFormat = 'shell' | 'ejson';

/**
 * Gets the current document view and edit format from VS Code settings.
 * @returns The configured format, defaulting to 'shell' if not set.
 */
export function getDocumentViewAndEditFormat(): DocumentViewAndEditFormat {
  return (
    vscode.workspace
      .getConfiguration('mdb')
      .get<DocumentViewAndEditFormat>('documentViewAndEditFormat') ?? 'shell'
  );
}

export function getUseWebViewDataBrowser(): boolean {
  return (
    vscode.workspace
      .getConfiguration('mdb')
      .get<boolean>('useWebViewDataBrowser') ?? true
  );
}

export function getDefaultSortOrder(): SortValueKey {
  return (
    vscode.workspace
      .getConfiguration('mdb')
      .get<SortValueKey>('defaultSortOrder') ?? 'default'
  );
}

export function getDefaultDocumentSort(): DocumentSort | undefined {
  return SORT_VALUE_MAP[getDefaultSortOrder()];
}
