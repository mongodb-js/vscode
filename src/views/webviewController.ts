import * as vscode from 'vscode';
import path from 'path';
import crypto from 'crypto';
import type { ConnectionOptions } from 'mongodb-data-service';

import type ConnectionController from '../connectionController';
import { ConnectionTypes } from '../connectionController';
import { createLogger } from '../logging';
import EXTENSION_COMMANDS from '../commands';
import type { MessageFromWebviewToExtension } from './webview-app/extension-app-message-constants';
import {
  MESSAGE_TYPES,
  VSCODE_EXTENSION_OIDC_DEVICE_AUTH_ID,
  VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID,
} from './webview-app/extension-app-message-constants';
import { openLink } from '../utils/linkHelper';
import type { StorageController } from '../storage';
import type TelemetryService from '../telemetry';
import { getFeatureFlagsScript } from '../featureFlags';
import {
  ConnectionEditedTelemetryEvent,
  LinkClickedTelemetryEvent,
  OpenEditConnectionTelemetryEvent,
} from '../telemetry';
import type { FileChooserOptions } from './webview-app/use-connection-form';

const log = createLogger('webview controller');

const getNonce = (): string => {
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

  const showOIDCDeviceAuthFlow = vscode.workspace
    .getConfiguration('mdb')
    .get('showOIDCDeviceAuthFlow');

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
      <script nonce="${nonce}">window['${VSCODE_EXTENSION_OIDC_DEVICE_AUTH_ID}'] = ${
    showOIDCDeviceAuthFlow ? 'true' : 'false'
  };</script>
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

  handleWebviewOpenFileChooserAttempt = async ({
    panel,
    fileChooserOptions,
    requestId,
  }: {
    panel: vscode.WebviewPanel;
    fileChooserOptions: FileChooserOptions;
    requestId: string;
  }): Promise<void> => {
    let files: vscode.Uri[] | vscode.Uri | undefined;

    try {
      if (fileChooserOptions.mode === 'open') {
        files = await vscode.window.showOpenDialog({
          defaultUri: vscode.Uri.from({
            path: fileChooserOptions.electronFileDialogOptions?.defaultPath,
            scheme: 'file',
          }),
          openLabel: fileChooserOptions.electronFileDialogOptions?.buttonLabel,
          filters:
            fileChooserOptions.electronFileDialogOptions?.filters?.reduce(
              (acc, filter) => {
                acc[filter.name] = filter.extensions;
                return acc;
              },
              {}
            ),
          title: fileChooserOptions.electronFileDialogOptions?.title,
        });
      } else if (fileChooserOptions.mode === 'save') {
        files = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.from({
            path: fileChooserOptions.electronFileDialogOptions?.defaultPath,
            scheme: 'file',
          }),
          saveLabel: fileChooserOptions.electronFileDialogOptions?.buttonLabel,
          filters:
            fileChooserOptions.electronFileDialogOptions?.filters?.reduce(
              (acc, filter) => {
                acc[filter.name] = filter.extensions;
                return acc;
              },
              {}
            ),
          title: fileChooserOptions.electronFileDialogOptions?.title,
        });
      }
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to open file chooser dialog: ${error}`
      );
    }

    void panel.webview.postMessage({
      command: MESSAGE_TYPES.OPEN_FILE_CHOOSER_RESULT,
      fileChooserResult: {
        canceled: false,
        ...(Array.isArray(files)
          ? {
              filePaths: files
                ? files?.map((file: vscode.Uri) => file.fsPath)
                : [],
            }
          : { filePath: files?.fsPath }),
      },
      requestId,
    });
  };

  handleWebviewConnectAttempt = async ({
    panel,
    connection,
    isEditingConnection,
  }: {
    panel: vscode.WebviewPanel;
    connection: {
      connectionOptions: ConnectionOptions;
      id: string;
    };
    isEditingConnection?: boolean;
  }): Promise<void> => {
    try {
      const { successfullyConnected, connectionErrorMessage } =
        isEditingConnection
          ? await this._connectionController.updateConnectionAndConnect({
              connectionId: connection.id,
              connectionOptions: connection.connectionOptions,
            })
          : await this._connectionController.saveNewConnectionAndConnect({
              connectionId: connection.id,
              connectionOptions: connection.connectionOptions,
              connectionType: ConnectionTypes.CONNECTION_FORM,
            });

      try {
        // The webview may have been closed in which case this will throw.
        void panel.webview.postMessage({
          command: MESSAGE_TYPES.CONNECT_RESULT,
          connectionId: connection.id,
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
        connectionId: connection.id,
        connectionSuccess: false,
        connectionMessage: `Unable to load connection: ${error}`,
      });
    }
  };

  // eslint-disable-next-line complexity
  handleWebviewMessage = async (
    message: MessageFromWebviewToExtension,
    panel: vscode.WebviewPanel
  ): Promise<void> => {
    switch (message.command) {
      case MESSAGE_TYPES.CONNECT:
        await this.handleWebviewConnectAttempt({
          panel,
          connection: message.connectionInfo,
        });
        return;
      case MESSAGE_TYPES.CANCEL_CONNECT:
        this._connectionController.cancelConnectionAttempt();
        return;
      case MESSAGE_TYPES.EDIT_CONNECTION_AND_CONNECT:
        await this.handleWebviewConnectAttempt({
          panel,
          connection: message.connectionInfo,
          isEditingConnection: true,
        });
        this._telemetryService.track(new ConnectionEditedTelemetryEvent());
        return;
      case MESSAGE_TYPES.OPEN_FILE_CHOOSER:
        await this.handleWebviewOpenFileChooserAttempt({
          panel,
          fileChooserOptions: message.fileChooserOptions,
          requestId: message.requestId,
        });
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
        this._telemetryService.track(
          new LinkClickedTelemetryEvent(message.screen, message.linkId)
        );
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

  onReceivedWebviewMessage = async (
    message: MessageFromWebviewToExtension,
    panel: vscode.WebviewPanel
  ): Promise<void> => {
    // Ensure handling message from the webview can't crash the extension.
    try {
      await this.handleWebviewMessage(message, panel);
    } catch (err) {
      log.error('Error occurred when parsing message from webview', err);
      return;
    }
  };

  onWebviewPanelClosed = (disposedPanel: vscode.WebviewPanel): void => {
    this._activeWebviewPanels = this._activeWebviewPanels.filter(
      (panel) => panel !== disposedPanel
    );
  };

  onThemeChanged = (theme: vscode.ColorTheme): void => {
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

  openEditConnection = async ({
    connection,
    context,
  }: {
    connection: {
      id: string;
      name?: string;
      connectionOptions: ConnectionOptions;
    };
    context: vscode.ExtensionContext;
  }): Promise<void> => {
    const webviewPanel = this.openWebview(context);

    // Wait for the panel to open.
    await new Promise((resolve) => setTimeout(resolve, 200));
    this._telemetryService.track(new OpenEditConnectionTelemetryEvent());

    void webviewPanel.webview.postMessage({
      command: MESSAGE_TYPES.OPEN_EDIT_CONNECTION,
      connection,
    });
  };

  openWebview(context: vscode.ExtensionContext): vscode.WebviewPanel {
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
      telemetryUserId: telemetryUserIdentity.anonymousId,
      webview: panel.webview,
    });

    // Handle messages from the webview.
    panel.webview.onDidReceiveMessage(
      (message: MessageFromWebviewToExtension) =>
        this.onReceivedWebviewMessage(message, panel),
      undefined,
      context.subscriptions
    );

    return panel;
  }
}
