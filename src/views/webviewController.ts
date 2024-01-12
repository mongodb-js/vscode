import * as vscode from 'vscode';
import path from 'path';
import crypto from 'crypto';
import type { ConnectionOptions } from 'mongodb-data-service';

import type ConnectionController from '../connectionController';
import { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import EXTENSION_COMMANDS from '../commands';
import type { MESSAGE_FROM_WEBVIEW_TO_EXTENSION } from './webview-app/extension-app-message-constants';
import {
  MESSAGE_TYPES,
  VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID,
} from './webview-app/extension-app-message-constants';
import { openLink } from '../utils/linkHelper';
import type { StorageController } from '../storage';
import type TelemetryService from '../telemetry/telemetryService';
import { getFeatureFlagsScript } from '../featureFlags';

const log = createLogger('webview controller');

const getNonce = () => {
  return crypto.randomBytes(16).toString('base64');
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

export const getWebviewContent = ({
  extensionPath,
  telemetryUserId,
  webview,
}: {
  extensionPath: string;
  telemetryUserId?: string;
  webview: vscode.Webview;
}): string => {
  const jsAppFileUrl = getReactAppUri(extensionPath, webview);

  // Use a nonce to only allow specific scripts to be run.
  const nonce = getNonce();

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none';
            script-src 'nonce-${nonce}' vscode-resource: 'self' 'unsafe-inline' https:;
            style-src vscode-resource: 'self' 'unsafe-inline';
            img-src vscode-resource: 'self'"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MongoDB</title>
    </head>
    <body>
      <div id="root"></div>
      ${getFeatureFlagsScript(nonce)}
      <script nonce="${nonce}">window['${VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID}'] = '${telemetryUserId}';</script>
      <script nonce="${nonce}" src="${jsAppFileUrl}"></script>
    </body>
  </html>`;
};

export default class WebviewController {
  _connectionController: ConnectionController;
  _storageController: StorageController;
  _telemetryService: TelemetryService;
  _activeWebviewPanels: vscode.WebviewPanel[] = [];
  _themeChangedSubscription: vscode.Disposable;

  constructor({
    connectionController,
    storageController,
    telemetryService,
  }: {
    connectionController: ConnectionController;
    storageController: StorageController;
    telemetryService: TelemetryService;
  }) {
    this._connectionController = connectionController;
    this._storageController = storageController;
    this._telemetryService = telemetryService;
    this._themeChangedSubscription = vscode.window.onDidChangeActiveColorTheme(
      this.onThemeChanged
    );
  }

  deactivate(): void {
    this._themeChangedSubscription?.dispose();
  }

  handleWebviewConnectAttempt = async (
    panel: vscode.WebviewPanel,
    connection: {
      connectionOptions: ConnectionOptions;
      id: string;
    },
    connectionAttemptId: string
  ) => {
    try {
      const { successfullyConnected, connectionErrorMessage } =
        await this._connectionController.saveNewConnectionAndConnect(
          connection,
          ConnectionTypes.CONNECTION_FORM
        );

      try {
        // The webview may have been closed in which case this will throw.
        void panel.webview.postMessage({
          command: MESSAGE_TYPES.CONNECT_RESULT,
          connectionAttemptId,
          connectionSuccess: successfullyConnected,
          connectionMessage: successfullyConnected
            ? `Successfully connected to ${this._connectionController.getActiveConnectionName()}.`
            : connectionErrorMessage,
        });
      } catch (err) {
        log.error('Unable to send connection result to webview', err);
      }
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to load connection: ${error}`
      );

      void panel.webview.postMessage({
        command: MESSAGE_TYPES.CONNECT_RESULT,
        connectionAttemptId,
        connectionSuccess: false,
        connectionMessage: `Unable to load connection: ${error}`,
      });
    }
  };

  // eslint-disable-next-line complexity
  handleWebviewMessage = async (
    message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
    panel: vscode.WebviewPanel
  ): Promise<void> => {
    switch (message.command) {
      case MESSAGE_TYPES.CONNECT:
        await this.handleWebviewConnectAttempt(
          panel,
          message.connectionInfo,
          message.connectionAttemptId
        );
        return;
      case MESSAGE_TYPES.CANCEL_CONNECT:
        this._connectionController.cancelConnectionAttempt();
        return;
      case MESSAGE_TYPES.CREATE_NEW_PLAYGROUND:
        void vscode.commands.executeCommand(
          EXTENSION_COMMANDS.MDB_CREATE_PLAYGROUND_FROM_OVERVIEW_PAGE
        );
        return;
      case MESSAGE_TYPES.CONNECTION_FORM_OPENED:
        // If the connection string input is open we want to close it
        // when the user opens the form.
        this._connectionController.closeConnectionStringInput();
        return;
      case MESSAGE_TYPES.GET_CONNECTION_STATUS:
        void panel.webview.postMessage({
          command: MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE,
          connectionStatus: this._connectionController.getConnectionStatus(),
          activeConnectionName:
            this._connectionController.getActiveConnectionName(),
        });
        return;
      case MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT:
        void vscode.commands.executeCommand(
          EXTENSION_COMMANDS.MDB_CONNECT_WITH_URI
        );
        return;
      case MESSAGE_TYPES.OPEN_TRUSTED_LINK:
        try {
          await openLink(message.linkTo);
        } catch (err) {
          // If opening the link fails we default to regular link opening.
          await vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.parse(message.linkTo)
          );
        }
        return;
      case MESSAGE_TYPES.EXTENSION_LINK_CLICKED:
        this._telemetryService.trackLinkClicked(message.screen, message.linkId);
        return;
      case MESSAGE_TYPES.RENAME_ACTIVE_CONNECTION:
        if (this._connectionController.isCurrentlyConnected()) {
          void this._connectionController.renameConnection(
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
      log.error('Error occured when parsing message from webview', err);
      return;
    }
  };

  onWebviewPanelClosed = (disposedPanel: vscode.WebviewPanel) => {
    this._activeWebviewPanels = this._activeWebviewPanels.filter(
      (panel) => panel !== disposedPanel
    );
  };

  onThemeChanged = (theme: vscode.ColorTheme) => {
    const darkModeDetected =
      theme.kind === vscode.ColorThemeKind.Dark ||
      theme.kind === vscode.ColorThemeKind.HighContrast;
    for (const panel of this._activeWebviewPanels) {
      void panel.webview
        .postMessage({
          command: MESSAGE_TYPES.THEME_CHANGED,
          darkMode: darkModeDetected,
        })
        .then(undefined, (error) => {
          log.warn(
            'Could not post THEME_CHANGED to webview, most like already disposed',
            error
          );
        });
    }
  };

  openWebview(context: vscode.ExtensionContext): Promise<boolean> {
    log.info('Opening webview...');
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
          vscode.Uri.file(path.join(extensionPath, 'resources')),
        ],
      }
    );

    panel.onDidDispose(() => this.onWebviewPanelClosed(panel));
    this._activeWebviewPanels.push(panel);

    panel.iconPath = vscode.Uri.file(
      path.join(
        extensionPath,
        'images',
        vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
          ? 'dark'
          : 'light',
        'leaf.svg'
      )
    );

    const telemetryUserIdentity = this._storageController.getUserIdentity();

    panel.webview.html = getWebviewContent({
      extensionPath,
      telemetryUserId:
        telemetryUserIdentity.anonymousId || telemetryUserIdentity.userId,
      webview: panel.webview,
    });

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
