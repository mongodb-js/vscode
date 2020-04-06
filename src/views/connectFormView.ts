import * as vscode from 'vscode';
const path = require('path');

import {
  MESSAGE_TYPES,
  ConnectMessage,
  OpenFilePickerMessage
} from './connect-form-app/extension-app-message-constants';

const openFileOptions = {
  canSelectFiles: true,
  canSelectFolders: false,
  canSelectMany: false, // Can be overridden.
  openLabel: 'Open',
  filters: {
    'All files': ['*']
  }
};

export const getConnectWebviewContent = (jsAppFileUrl: vscode.Uri): string => {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Connect to MongoDB</title>
    </head>
    <body>
      <div id="root"></div>
      <script src="${jsAppFileUrl}"></script>
    </body>
  </html>`;
};

export const getReactAppUri = (extensionPath: string): vscode.Uri => {
  const jsAppFilePath = vscode.Uri.file(
    path.join(extensionPath, 'out', 'connect-form', 'connectForm.js')
  );
  return jsAppFilePath.with({ scheme: 'vscode-resource' });
};

const handleWebviewMessage = (
  message: ConnectMessage | OpenFilePickerMessage,
  panel: vscode.WebviewPanel,
  connect: (connectionString: string) => Promise<boolean>
): void => {
  switch (message.command) {
    case MESSAGE_TYPES.CONNECT:
      connect(message.driverUrl).then(
        (connectionSuccess) => {
          panel.webview.postMessage({
            command: MESSAGE_TYPES.CONNECT_RESULT,
            connectionSuccess,
            connectionMessage: connectionSuccess
              ? 'Connected.'
              : 'Unable to connect.'
          });
        },
        (err: Error) => {
          panel.webview.postMessage({
            command: MESSAGE_TYPES.CONNECT_RESULT,
            connectionSuccess: false,
            connectionMessage: err.message
          });
        }
      );
      return;
    case MESSAGE_TYPES.OPEN_FILE_PICKER:
      vscode.window
        .showOpenDialog({
          ...openFileOptions,
          canSelectMany: message.multi
        })
        .then((files) => {
          panel.webview.postMessage({
            command: MESSAGE_TYPES.FILE_PICKER_RESULTS,
            action: message.action,
            files:
              files && files.length > 0
                ? files.map((file) => file.path)
                : undefined
          });
        });
      return;
    default:
      // no-op.
      return;
  }
};

export default class ConnectFormView {
  showConnectForm(
    context: vscode.ExtensionContext,
    connect: (connectionString: string) => Promise<boolean>
  ): Promise<boolean> {
    const extensionPath = context.extensionPath;

    // Create and show a new connect dialogue webview.
    const panel = vscode.window.createWebviewPanel(
      'connectDialogueWebview',
      'Connect to MongoDB', // Title
      vscode.ViewColumn.One, // Editor column to show the webview panel in.
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionPath, 'out', 'connect-form'))
        ]
      }
    );

    const reactAppUri = getReactAppUri(extensionPath);
    panel.webview.html = getConnectWebviewContent(reactAppUri);

    // Handle messages from the webview.
    panel.webview.onDidReceiveMessage(
      (message: ConnectMessage | OpenFilePickerMessage) =>
        handleWebviewMessage(message, panel, connect),
      undefined,
      context.subscriptions
    );

    return Promise.resolve(true);
  }
}
