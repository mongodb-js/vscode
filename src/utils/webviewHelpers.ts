import * as vscode from 'vscode';
import path from 'path';
import crypto from 'crypto';

export const getNonce = (): string => {
  return crypto.randomBytes(16).toString('base64');
};

export const getThemedIconPath = (
  extensionPath: string,
  iconName: string,
): { light: vscode.Uri; dark: vscode.Uri } => {
  return {
    light: vscode.Uri.file(
      path.join(extensionPath, 'images', 'light', iconName),
    ),
    dark: vscode.Uri.file(path.join(extensionPath, 'images', 'dark', iconName)),
  };
};

export const getWebviewUri = (
  extensionPath: string,
  webview: vscode.Webview,
  ...pathSegments: string[]
): vscode.Uri => {
  const localFilePathUri = vscode.Uri.file(
    path.join(extensionPath, ...pathSegments),
  );
  return webview.asWebviewUri(localFilePathUri);
};

export type WebviewType = 'connection' | 'dataBrowser';

export interface WebviewHtmlOptions {
  extensionPath: string;
  webview: vscode.Webview;
  webviewType: WebviewType;
  title?: string;
  additionalHeadContent?: string;
}

export const getWebviewHtml = ({
  extensionPath,
  webview,
  webviewType,
  title = 'MongoDB',
  additionalHeadContent = '',
}: WebviewHtmlOptions): string => {
  const nonce = getNonce();
  const scriptUri = getWebviewUri(
    extensionPath,
    webview,
    'dist',
    'webviewApp.js',
  );

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none';
          script-src 'nonce-${nonce}' vscode-resource: 'self' 'unsafe-inline' https:;
          style-src vscode-resource: 'self' 'unsafe-inline';
          img-src vscode-resource: 'self'"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}">window.WEBVIEW_TYPE = '${webviewType}';</script>
      ${additionalHeadContent.replace(/\$\{nonce\}/g, nonce)}
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
  </html>`;
};

export interface CreateWebviewPanelOptions {
  viewType: string;
  title: string;
  extensionPath: string;
  column?: vscode.ViewColumn;
  additionalResourceRoots?: string[];
  iconName?: string;
}

export const createWebviewPanel = ({
  viewType,
  title,
  extensionPath,
  column = vscode.ViewColumn.One,
  additionalResourceRoots = [],
  iconName,
}: CreateWebviewPanelOptions): vscode.WebviewPanel => {
  const localResourceRoots = [
    vscode.Uri.file(path.join(extensionPath, 'dist')),
    ...additionalResourceRoots.map((folder) =>
      vscode.Uri.file(path.join(extensionPath, folder)),
    ),
  ];

  const panel = vscode.window.createWebviewPanel(viewType, title, column, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots,
  });

  if (iconName) {
    panel.iconPath = getThemedIconPath(extensionPath, iconName);
  }

  return panel;
};
