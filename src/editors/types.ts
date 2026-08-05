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

/**
 * Gets whether the user opted into the classic, editor-based data browsing
 * experience (instead of the webview-based data browser) from VS Code settings.
 * @returns `true` if the classic experience should be used, defaulting to `false`.
 */
export function getUseClassicDataBrowsingExperience(): boolean {
  return (
    vscode.workspace
      .getConfiguration('mdb')
      .get<boolean>('useClassicDataBrowsingExperience') ?? false
  );
}
