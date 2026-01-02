import * as vscode from 'vscode';

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
