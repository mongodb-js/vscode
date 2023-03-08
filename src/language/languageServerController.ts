import * as vscode from 'vscode';
import * as path from 'path';
import type { MongoClientOptions } from 'mongodb';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  CancellationTokenSource,
} from 'vscode-languageclient/node';
import { workspace, ExtensionContext } from 'vscode';

import { createLogger } from '../logging';
import {
  PlaygroundExecuteParameters,
  ShellExecuteAllResult,
  ExportToLanguageMode,
  ExportToLanguageNamespace,
  PlaygroundTextAndSelection,
} from '../types/playgroundType';
import { ServerCommands } from './serverCommands';
import { installModuleWithProgress } from './installModuleWithProgress';
import formatError from '../utils/formatError';

const log = createLogger('language server controller');

/**
 * This controller manages the language server and client.
 */
export default class LanguageServerController {
  _context: ExtensionContext;
  _source?: CancellationTokenSource;
  _isExecutingInProgress = false;
  _client: LanguageClient;

  constructor(context: ExtensionContext) {
    this._context = context;

    // The server is implemented in node.
    const serverModule = path.join(
      this._context.extensionPath,
      'dist',
      'languageServer.js'
    );

    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode
    // so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: debugOptions,
      },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for mongodb documents
      documentSelector: [
        { scheme: 'untitled', language: 'javascript' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'vscode-notebook-cell', language: 'javascript' },
      ],
      synchronize: {
        // Notify the server about file changes in the workspace
        fileEvents: workspace.createFileSystemWatcher('**/*'),
      },
      outputChannel: vscode.window.createOutputChannel(
        'MongoDB Language Server'
      ),
    };

    log.info('Create MongoDB Language Server', {
      serverOptions,
      clientOptions,
    });

    // Create the language server client
    this._client = new LanguageClient(
      'mongodbLanguageServer',
      'MongoDB Language Server',
      serverOptions,
      clientOptions
    );
  }

  async startLanguageServer(): Promise<void> {
    // Push the disposable client to the context's subscriptions so that the
    // client can be deactivated on extension deactivation.
    if (!this._context.subscriptions.includes(this._client)) {
      this._context.subscriptions.push(this._client);
    }

    // Subscribe on notifications from the server when the client is ready.
    await this._client.sendRequest(
      ServerCommands.SET_EXTENSION_PATH,
      this._context.extensionPath
    );

    this._client.onNotification(
      ServerCommands.SHOW_INFO_MESSAGE,
      (messsage) => {
        void vscode.window.showInformationMessage(messsage);
      }
    );

    this._client.onNotification(
      ServerCommands.SHOW_ERROR_MESSAGE,
      ({ code, moduleName, message }) => {
        if (code === 'MODULE_NOT_FOUND' && moduleName) {
          void vscode.window
            .showErrorMessage(message, { modal: false }, 'Yes', 'No')
            .then(async (response) => {
              if (response === 'Yes') {
                try {
                  const result = await installModuleWithProgress(moduleName);

                  if (result.ok) {
                    void vscode.window.showInformationMessage(
                      `The '${moduleName}' module was installed.`
                    );
                  }

                  if (result.canceled) {
                    void vscode.window.showInformationMessage(
                      `The installation of the '${moduleName}' module was canceled.`
                    );
                  }
                } catch (error) {
                  void vscode.window.showErrorMessage(
                    formatError(error).message
                  );
                }
              }
            });
        } else {
          void vscode.window.showErrorMessage(message);
        }
      }
    );
  }

  deactivate(): void {
    // Stop the language server
    void this._client.stop();
  }

  async executeAll(
    playgroundExecuteParameters: PlaygroundExecuteParameters
  ): Promise<ShellExecuteAllResult> {
    this._isExecutingInProgress = true;

    // Instantiate a new CancellationTokenSource object
    // that generates a cancellation token for each run of a playground
    this._source = new CancellationTokenSource();

    // Send a request with a cancellation token
    // to the language server server to execute scripts from a playground
    // and return results to the playground controller when ready
    const result: ShellExecuteAllResult = await this._client.sendRequest(
      ServerCommands.EXECUTE_ALL_FROM_PLAYGROUND,
      playgroundExecuteParameters,
      this._source.token
    );

    this._isExecutingInProgress = false;

    return result;
  }

  async getExportToLanguageMode(
    params: PlaygroundTextAndSelection
  ): Promise<ExportToLanguageMode> {
    return this._client.sendRequest(
      ServerCommands.GET_EXPORT_TO_LANGUAGE_MODE,
      params
    );
  }

  async getNamespaceForSelection(
    params: PlaygroundTextAndSelection
  ): Promise<ExportToLanguageNamespace> {
    return this._client.sendRequest(
      ServerCommands.GET_NAMESPACE_FOR_SELECTION,
      params
    );
  }

  async connectToServiceProvider(params: {
    connectionId: string;
    connectionString: string;
    connectionOptions: MongoClientOptions;
  }): Promise<void> {
    await this._client.sendRequest(
      ServerCommands.CONNECT_TO_SERVICE_PROVIDER,
      params
    );
  }

  async disconnectFromServiceProvider(): Promise<void> {
    await this._client.sendRequest(
      ServerCommands.DISCONNECT_TO_SERVICE_PROVIDER
    );
  }

  cancelAll(): void {
    // Send a request for cancellation. As a result
    // the associated CancellationToken will be notified of the cancellation,
    // the onCancellationRequested event will be fired,
    // and IsCancellationRequested will return true.
    if (this._isExecutingInProgress) {
      this._source?.cancel();
      this._isExecutingInProgress = false;
    }
  }
}
