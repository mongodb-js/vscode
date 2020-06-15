import * as vscode from 'vscode';
import ConnectionController from '../connectionController';
import TelemetryController from '../telemetry/telemetryController';
import {
  MESSAGE_TYPES,
  ConnectMessage,
  OpenFilePickerMessage,
  OpenConnectionStringInputMessage,
  LinkClickedMessage
} from './webview-app/extension-app-message-constants';
import { createLogger } from '../logging';

const path = require('path');
const log = createLogger('webviewController');

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
    path.join(extensionPath, 'dist', 'webviewApp.js')
  );
  return jsAppFilePath.with({ scheme: 'vscode-resource' });
};

export default class WebviewController {
  _connectionController: ConnectionController;
  _telemetryController: TelemetryController;

  constructor(
    connectionController: ConnectionController,
    telemetryController: TelemetryController
  ) {
    this._connectionController = connectionController;
    this._telemetryController = telemetryController;
  }

  handleWebviewMessage = (
    message:
      | ConnectMessage
      | OpenFilePickerMessage
      | LinkClickedMessage
      | OpenConnectionStringInputMessage,
    panel: vscode.WebviewPanel
  ): void => {
    switch (message.command) {
      case MESSAGE_TYPES.CONNECT:
        this._connectionController
          .parseNewConnectionAndConnect(message.connectionModel)
          .then(
            (connectionSuccess) => {
              panel.webview.postMessage({
                command: MESSAGE_TYPES.CONNECT_RESULT,
                connectionSuccess,
                connectionMessage: connectionSuccess
                  ? 'Successfully connected.'
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
                  ? files.map((file) => path.toNamespacedPath(file.path))
                  : undefined
            });
          });
        return;
      case MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT:
        vscode.commands
          .executeCommand('mdb.connectWithURI')
          .then((connectionSuccess) => {
            if (connectionSuccess) {
              panel.webview.postMessage({
                command: MESSAGE_TYPES.CONNECT_RESULT,
                connectionSuccess: true,
                connectionMessage: 'Successfully connected.',
                isUriConnection: true
              });
            }
          });

        return;
      case MESSAGE_TYPES.EXTENSION_LINK_CLICKED:
        this._telemetryController.trackLinkClicked(
          message.screen,
          message.linkId
        );

        return;
      default:
        // no-op.
        return;
    }
  };

  showConnectForm(context: vscode.ExtensionContext): Promise<boolean> {
    log.info('show connect form called.');

    const extensionPath = context.extensionPath;

    // Create and show a new connect dialogue webview.
    const panel = vscode.window.createWebviewPanel(
      'connectDialogueWebview',
      'Connect to MongoDB', // Title
      vscode.ViewColumn.One, // Editor column to show the webview panel in.
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'dist'))]
      }
    );

    panel.iconPath = vscode.Uri.file(
      path.join(extensionPath, 'images', 'leaf.svg')
    );

    const reactAppUri = getReactAppUri(extensionPath);
    panel.webview.html = getConnectWebviewContent(reactAppUri);

    // Handle messages from the webview.
    panel.webview.onDidReceiveMessage(
      (message: ConnectMessage | OpenFilePickerMessage) =>
        this.handleWebviewMessage(message, panel),
      undefined,
      context.subscriptions
    );

    return Promise.resolve(true);
  }
}
