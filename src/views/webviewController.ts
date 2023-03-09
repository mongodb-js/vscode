import * as vscode from 'vscode';
import path from 'path';
import crypto from 'crypto';

import ConnectionController, { ConnectionTypes } from '../connectionController';
import LegacyConnectionModel from './webview-app/connection-model/legacy-connection-model';
import { createLogger } from '../logging';
import EXTENSION_COMMANDS from '../commands';
import {
  MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
  MESSAGE_TYPES,
  VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID,
  OpenFilePickerMessage,
} from './webview-app/extension-app-message-constants';
import { openLink } from '../utils/linkHelper';
import { StorageController } from '../storage';
import TelemetryService from '../telemetry/telemetryService';
import { gitDiffStyles } from './gitDiffStyles';
import { getFileStructure } from '../ai-code/local-files';
import { runAICode } from '../ai-code/code-editor';
import { askQuestion } from '../ai-code/question-answerer';

const log = createLogger('webviewController');

const getNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

const openFileOptions = {
  canSelectFiles: true,
  canSelectFolders: false,
  canSelectMany: false, // Can be overridden.
  openLabel: 'Open',
  filters: {
    'All files': ['*'],
  },
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
  isSidepanel = false,
  isCodeWindow = false,
}: {
  extensionPath: string;
  telemetryUserId?: string;
  webview: vscode.Webview;
  isSidepanel?: boolean;
  isCodeWindow?: boolean;
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
        ${gitDiffStyles}
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}">
        window['${VSCODE_EXTENSION_SEGMENT_ANONYMOUS_ID}'] = '${telemetryUserId}';
        window.isSidepanel = ${isSidepanel ? 'true' : 'false'};
        window.isCodeWindow = ${isCodeWindow ? 'true' : 'false'};
      </script>
      <script nonce="${nonce}" src="${jsAppFileUrl}"></script>
    </body>
  </html>`;
};

// TODO: Currently we're overloading this with 2 webviews, we should have a provider for each.
export default class WebviewController implements vscode.WebviewViewProvider {
  _connectionController: ConnectionController;
  _storageController: StorageController;
  _telemetryService: TelemetryService;
  _extensionPath: string;
  _selectedText = '';

  // TODO: Don't overload this view controller lol.
  viewType: 'mongoDBAIAssistantWebview' | 'codeAIAssistantWebview' =
    'mongoDBAIAssistantWebview';
  // static readonly viewType = 'mongoDBAIAssistantWebview';

  _view?: vscode.WebviewView;

  constructor(
    connectionController: ConnectionController,
    storageController: StorageController,
    telemetryService: TelemetryService,
    extensionPath: string,
    viewType:
      | 'mongoDBAIAssistantWebview'
      | 'codeAIAssistantWebview' = 'mongoDBAIAssistantWebview'
  ) {
    this._extensionPath = extensionPath;
    this._connectionController = connectionController;
    this._storageController = storageController;
    this._telemetryService = telemetryService;
    this.viewType = viewType;
  }

  handleWebviewConnectAttempt = async (
    panel: vscode.WebviewPanel | vscode.WebviewView,
    rawConnectionModel: LegacyConnectionModel,
    connectionAttemptId: string
  ): Promise<void> => {
    try {
      const connectionInfo =
        this._connectionController.parseNewConnection(rawConnectionModel);
      const { successfullyConnected, connectionErrorMessage } =
        await this._connectionController.saveNewConnectionAndConnect(
          connectionInfo,
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
        log.error('Unable to send connection result to webview:', err);
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

  resolveWebviewView(
    webviewView: vscode.WebviewView
    // context: vscode.WebviewViewResolveContext,
    // _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    // const extensionPath = context.extensionPath;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      // retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._extensionPath, 'dist')),
        vscode.Uri.file(path.join(this._extensionPath, 'resources')),
      ],
    };

    const telemetryUserIdentity = this._storageController.getUserIdentity();

    webviewView.webview.html = getWebviewContent({
      extensionPath: this._extensionPath,
      telemetryUserId:
        telemetryUserIdentity.anonymousId || telemetryUserIdentity.userId,
      webview: webviewView.webview,
      isSidepanel: true,
      isCodeWindow: this.viewType === 'codeAIAssistantWebview',
    });

    // Handle messages from the webview.
    webviewView.webview.onDidReceiveMessage(
      (message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION) =>
        this._view === webviewView
          ? this.onReceivedWebviewMessage(message, webviewView)
          : () => {
              /* noop*/
            }
    );

    if (this.viewType === 'codeAIAssistantWebview') {
      return;
    }

    vscode.window.onDidChangeTextEditorSelection(
      (changeEvent: vscode.TextEditorSelectionChangeEvent) => {
        // Sort lines selected as the may be mis-ordered from alt+click.
        const sortedSelections = (
          changeEvent.selections as Array<vscode.Selection>
        ).sort((a, b) => (a.start.line > b.start.line ? 1 : -1));

        const selectedText = sortedSelections
          .map((item) => this._getSelectedText(item))
          .join('\n');

        if (selectedText === this._selectedText) {
          return;
        }

        // TODO
        if (this._view === webviewView) {
          this._selectedText = selectedText;

          void webviewView.webview.postMessage({
            command: MESSAGE_TYPES.CODE_SELECTION_UPDATED,
            selectedText,
            fileName: vscode.window?.activeTextEditor?.document.fileName || '',
          });
        }
      }
    );

    console.log('Started webview view');
  }

  handleWebviewOpenFilePickerRequest = async (
    message: OpenFilePickerMessage,
    panel: vscode.WebviewPanel | vscode.WebviewView
  ): Promise<void> => {
    const files = await vscode.window.showOpenDialog({
      ...openFileOptions,
      canSelectMany: message.multi,
    });
    void panel.webview.postMessage({
      command: MESSAGE_TYPES.FILE_PICKER_RESULTS,
      action: message.action,
      files:
        files && files.length > 0
          ? files.map((file) => file.fsPath)
          : undefined,
    });
  };

  // eslint-disable-next-line complexity
  handleWebviewMessage = async (
    message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
    panel: vscode.WebviewPanel | vscode.WebviewView
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
        void vscode.commands.executeCommand(
          EXTENSION_COMMANDS.MDB_CREATE_PLAYGROUND_FROM_OVERVIEW_PAGE
        );
        return;
      case MESSAGE_TYPES.GET_CONNECTION_STATUS:
        void panel.webview.postMessage({
          command: MESSAGE_TYPES.CONNECTION_STATUS_MESSAGE,
          connectionStatus: this._connectionController.getConnectionStatus(),
          activeConnectionName:
            this._connectionController.getActiveConnectionName(),
        });
        return;
      case MESSAGE_TYPES.OPEN_FILE_PICKER:
        await this.handleWebviewOpenFilePickerRequest(message, panel);
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

      case MESSAGE_TYPES.LOAD_CODEBASE:
        try {
          // const { fileCount, fileStructure, workingDirectory } =
          //   await cloneAndAnalyzeCodebase({
          //     githubLink: message.githubLink,
          //     useGithubLink: message.useGithubLink,
          //   });

          if (vscode.workspace.workspaceFolders === undefined) {
            throw new Error('No workspace currently open.');
          }

          const workingDirectory =
            vscode.workspace.workspaceFolders[0].uri.path;
          // let f = vscode.workspace.workspaceFolders[0].uri.fsPath;
          // Analyze the directory/file structure.
          const { fileStructure, fileCount } = await getFileStructure({
            inputFolder: workingDirectory,
          });

          console.log(
            'successfully ran cloneAndAnalyzeCodebase',
            fileCount,
            fileStructure,
            workingDirectory
          );

          void panel.webview.postMessage({
            command: MESSAGE_TYPES.CODEBASE_LOADED,
            id: message.id,
            fileCount,
            fileStructure,
            workingDirectory,
          });
        } catch (e) {
          console.log('error with cloneAndAnalyzeCodebase', e);
          void panel.webview.postMessage({
            command: MESSAGE_TYPES.CODEBASE_LOADED,
            id: message.id,
            error: (e as Error)?.message,
          });
        }
        return;

      case MESSAGE_TYPES.ASK_QUESTION:
        try {
          const response = await askQuestion({
            history: message.history,
            newMessage: message.newMessage,
            conversationId: message.conversationId,
          });

          console.log('question response', response);

          void panel.webview.postMessage({
            command: MESSAGE_TYPES.QUESTION_RESPONSE,
            id: message.id,
            text: response.text,
            questionText: response.questionText,
            conversationId: message.conversationId,
          });
        } catch (e) {
          console.log('error with askQuestion', e);
          void panel.webview.postMessage({
            command: MESSAGE_TYPES.QUESTION_RESPONSE,
            id: message.id,
            error: (e as Error)?.message,
          });
        }
        return;

      case MESSAGE_TYPES.LOAD_SUGGESTIONS:
        try {
          const { diffResult, descriptionOfChanges } = await runAICode({
            workingDirectory: message.workingDirectory,
            fileStructure: message.fileStructure,
            useChatbot: message.useChatbot,
            promptText: message.promptText,
          });

          console.log(
            'successfully ran runAICode',
            diffResult,
            descriptionOfChanges
          );

          void panel.webview.postMessage({
            command: MESSAGE_TYPES.SUGGESTIONS_LOADED,
            id: message.id,
            diffResult,
            descriptionOfChanges,
          });
        } catch (e) {
          console.log('error with runAICode', e);
          void panel.webview.postMessage({
            command: MESSAGE_TYPES.SUGGESTIONS_LOADED,
            id: message.id,
            error: (e as Error)?.message,
          });
        }
        return;

      default:
        // no-op.
        return;
    }
  };

  onReceivedWebviewMessage = async (
    message: MESSAGE_FROM_WEBVIEW_TO_EXTENSION,
    panel: vscode.WebviewPanel | vscode.WebviewView
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

  _getSelectedText(selection: vscode.Range): string {
    return vscode.window.activeTextEditor?.document.getText(selection) || '';
  }

  openWebview(context: vscode.ExtensionContext): Promise<boolean> {
    log.info('open webview called.');

    const extensionPath = context.extensionPath;

    // Create and show a new connect dialogue webview.
    const panel = vscode.window.createWebviewPanel(
      'connectDialogueWebview',
      'MongoDB',
      vscode.ViewColumn.One, // Editor column to show the webview panel in.
      {
        enableScripts: true,
        retainContextWhenHidden: true, // TODO: Get rid of this, it's a performance hit.
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionPath, 'dist')),
          vscode.Uri.file(path.join(extensionPath, 'resources')),
        ],
      }
    );

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
        this.onReceivedWebviewMessage(message, panel),
      undefined,
      context.subscriptions
    );

    return Promise.resolve(true);
  }
}
