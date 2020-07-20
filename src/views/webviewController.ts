import * as vscode from 'vscode';
import ConnectionController, {
  DataServiceEventTypes,
  ConnectionTypes
} from '../connectionController';
import TelemetryController from '../telemetry/telemetryController';
import {
  MESSAGE_TYPES,
  WEBVIEWS,
  WEBVIEW_TYPE_GLOBAL_ID,
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

export const getWebviewContent = (webviewToShow: WEBVIEWS, jsAppFileUrl: vscode.Uri): string => {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Connect to MongoDB</title>
        <script>
          window["${WEBVIEW_TYPE_GLOBAL_ID}"] = "${webviewToShow}";
        </script>
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

  listenForConnectionResultsAndUpdatePanel = (
    panel: vscode.WebviewPanel
  ): any => {
    const connectionDidChange = (): void => {
      if (
        !this._connectionController.isConnecting()
      ) {
        this._connectionController.removeEventListener(
          DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
          connectionDidChange
        );

        panel.webview.postMessage({
          command: MESSAGE_TYPES.CONNECT_RESULT,
          connectionSuccess: this._connectionController.isCurrentlyConnected(),
          connectionMessage: this._connectionController.isCurrentlyConnected()
            ? `Successfully connected to ${this._connectionController.getActiveConnectionName()}.`
            : 'Unable to connect.'
        });
      }
    };

    this._connectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      connectionDidChange
    );

    // We return the listening function so we can remove the listener elsewhere.
    return connectionDidChange;
  };

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
        try {
          const connectionModel = this._connectionController
            .parseNewConnection(message.connectionModel);

          this.listenForConnectionResultsAndUpdatePanel(panel);

          this._connectionController.saveNewConnectionAndConnect(
            connectionModel,
            ConnectionTypes.CONNECTION_FORM
          );
        } catch (error) {
          vscode.window.showErrorMessage(`Unable to load connection: ${error}`);

          panel.webview.postMessage({
            command: MESSAGE_TYPES.CONNECT_RESULT,
            connectionSuccess: false,
            connectionMessage: `Unable to load connection: ${error}`
          });
        }
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
                  ? files.map((file) => path.resolve(file.path.substr(1)))
                  : undefined
            });
          });
        return;
      case MESSAGE_TYPES.OPEN_CONNECTION_STRING_INPUT:
        this.listenForConnectionResultsAndUpdatePanel(panel);
        vscode.commands.executeCommand('mdb.connectWithURI');

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
    panel.webview.html = getWebviewContent(WEBVIEWS.CONNECT, reactAppUri);

    // Handle messages from the webview.
    panel.webview.onDidReceiveMessage(
      (message: ConnectMessage | OpenFilePickerMessage) =>
        this.handleWebviewMessage(message, panel),
      undefined,
      context.subscriptions
    );

    return Promise.resolve(true);
  }

  openChangeStreamViewer(context: vscode.ExtensionContext): Promise<boolean> {
    log.info('open change stream view called.');

    const extensionPath = context.extensionPath;

    // Create and show a new connect dialogue webview.
    const panel = vscode.window.createWebviewPanel(
      'connectDialogueWebview',
      'MongoDB Change Stream', // Title
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
    panel.webview.html = getWebviewContent(WEBVIEWS.CHANGE_STREAM, reactAppUri);

    // Handle messages from the webview.
    panel.webview.onDidReceiveMessage(
      (message: ConnectMessage | OpenFilePickerMessage) =>
        this.handleWebviewMessage(message, panel),
      undefined,
      context.subscriptions
    );

    this.registerChangeStreamWatchers(panel);

    return Promise.resolve(true);
  }

  registerChangeStreamWatchers(panel: vscode.WebviewPanel): void {
    // NOTE: This only works on replica sets.

    console.log('Registering change stream watchers...');
    const activeConnection = this._connectionController.getActiveDataService();

    if (activeConnection === null) {
      vscode.window.showErrorMessage('Not currently connected. Cannot show change stream.');
      return;
    }

    const connectionClient = activeConnection.client;
    // const clientDB = connectionClient._database(dbToWatch);

    // const dbChangeStream = clientDB.watch();
    const changeStream = connectionClient.watch();

    console.log('Registered change stream watcher, now watching...');

    changeStream.on('change', (changeStreamItem: any) => {
      console.log('Change stream event occured:', changeStreamItem);
      if (panel) {
        panel.webview.postMessage({
          command: MESSAGE_TYPES.CHANGE_STREAM_EVENT,
          changeStreamEvent: changeStreamItem
        });
      }
    });
  }
}
