import * as vscode from 'vscode';
import * as path from 'path';

import ConnectionController, {
  ConnectionTypes
} from '../connectionController';
import TelemetryController from '../telemetry/telemetryController';
import {
  MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
  MESSAGE_TYPES,
  OpenFilePickerMessage
} from './webview-app/extension-app-message-constants';
import { createLogger } from '../logging';
import EXTENSION_COMMANDS from '../commands';
import ConnectionModel from './webview-app/connection-model/connection-model';

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

export const getReactAppUri = (
  extensionPath: string,
  webview: vscode.Webview
): vscode.Uri => {
  const localFilePathUri = vscode.Uri.file(
    path.join(extensionPath, 'dist', 'webviewApp.js')
  );
  const jsAppFileWebviewUri = webview.asWebviewUri(localFilePathUri);
  return jsAppFileWebviewUri;
};

export const getWebviewContent = (
  extensionPath: string,
  webview: vscode.Webview
): string => {
  const jsAppFileUrl = getReactAppUri(extensionPath, webview);

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MongoDB</title>
    </head>
    <body>
      <div id="root"></div>
      <script src="${jsAppFileUrl}"></script>
    </body>
  </html>`;
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

  handleWebviewConnectAttempt = async (
    panel: vscode.WebviewPanel,
    rawConnectionModel: ConnectionModel,
    connectionAttemptId: string
  ): Promise<void> => {
    try {
      const connectionModel = this._connectionController
        .parseNewConnection(rawConnectionModel);

      const {
        successfullyConnected,
        connectionErrorMessage
      } = await this._connectionController.saveNewConnectionAndConnect(
        connectionModel,
        ConnectionTypes.CONNECTION_FORM
      );

      try {
        // The webview may have been closed in which case this will throw.
        panel.webview.postMessage({
          command: MESSAGE_TYPES.CONNECT_RESULT,
          connectionAttemptId,
          connectionSuccess: successfullyConnected,
          connectionMessage: successfullyConnected
            ? `Successfully connected to ${this._connectionController.getActiveConnectionName()}.`
            : connectionErrorMessage
        });
      } catch (err) {
        log.error('Unable to send connection result to webview:', err);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Unable to load connection: ${error}`);

      panel.webview.postMessage({
        command: MESSAGE_TYPES.CONNECT_RESULT,
        connectionAttemptId,
        connectionSuccess: false,
        connectionMessage: `Unable to load connection: ${error}`
      });
    }
  };

  handleWebviewOpenFilePickerRequest = async (
    message: OpenFilePickerMessage,
    panel: vscode.WebviewPanel
  ): Promise<void> => {
    const files = await vscode.window.showOpenDialog({
      ...openFileOptions,
      canSelectMany: message.multi
    });
    panel.webview.postMessage({
      command: MESSAGE_TYPES.FILE_PICKER_RESULTS,
      action: message.action,
      files: (files && files.length > 0)
        ? files.map((file) => path.resolve(file.path.substr(1)))
        : undefined
    });
  };

  handleWebviewMessage = async (
    message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
    panel: vscode.WebviewPanel
  ): Promise<void> => {
    switch (message.command) {
      case MESSAGE_TYPES.CONNECT:
        await this.handleWebviewConnectAttempt(
          panel,
          message.connectionModel,
          message.connectionAttemptId
        );
        return;
      case MESSAGE_TYPES.CREATE_NEW_PLAYGROUND:
        vscode.commands.executeCommand(
          EXTENSION_COMMANDS.MDB_CREATE_PLAYGROUND_FROM_OVERVIEW_PAGE
        );
        return;
      case MESSAGE_TYPES.GET_CONNECTION_STATUS:
        panel.webview.postMessage({
          command: MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE,
          connectionStatus: this._connectionController.getConnectionStatus(),
          activeConnectionName: this._connectionController.getActiveConnectionName()
        });
        return;
      case MESSAGE_TYPES.OPEN_FILE_PICKER:
        await this.handleWebviewOpenFilePickerRequest(message, panel);
        return;
      case MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT:
        vscode.commands.executeCommand(EXTENSION_COMMANDS.MDB_CONNECT_WITH_URI);

        return;
      case MESSAGE_TYPES.EXTENSION_LINK_CLICKED:
        this._telemetryController.trackLinkClicked(
          message.screen,
          message.linkId
        );

        return;

      case MESSAGE_TYPES.RENAME_ACTIVE_CONNECTION:
        if (this._connectionController.isCurrentlyConnected()) {
          this._connectionController.renameConnection(
            this._connectionController.getActiveConnectionId() as string
          );
        }

        return;
      default:
        // no-op.
        return;
    }
  };

  onRecievedWebviewMessage = async (
    message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
    panel: vscode.WebviewPanel
  ): Promise<void> => {
    // Ensure handling message from the webview can't crash the extension.
    try {
      await this.handleWebviewMessage(message, panel);
    } catch (err) {
      log.info('Error occured when parsing message from webview:');
      log.info(err);

      return;
    }
  };

  openWebview(
    context: vscode.ExtensionContext
  ): Promise<boolean> {
    log.info('open webview called.');

    const extensionPath = context.extensionPath;

    // Create and show a new connect dialogue webview.
    const panel = vscode.window.createWebviewPanel(
      'connectDialogueWebview',
      'MongoDB',
      vscode.ViewColumn.One, // Editor column to show the webview panel in.
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionPath, 'dist')),
          vscode.Uri.file(path.join(extensionPath, 'resources'))
        ]
      }
    );

    panel.iconPath = vscode.Uri.file(
      path.join(extensionPath, 'images', 'leaf.svg')
    );

    panel.webview.html = getWebviewContent(extensionPath, panel.webview);

    // Handle messages from the webview.
    panel.webview.onDidReceiveMessage(
      (message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION) =>
        this.onRecievedWebviewMessage(message, panel),
      undefined,
      context.subscriptions
    );

    return Promise.resolve(true);
  }
}
