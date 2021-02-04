import * as vscode from 'vscode';
import * as path from 'path';
import { EJSON } from 'bson';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  CancellationTokenSource
} from 'vscode-languageclient';
import WebSocket from 'ws';
import { workspace, ExtensionContext, OutputChannel } from 'vscode';

import { createLogger } from '../logging';
import { PlaygroundExecuteParameters } from '../types/playgroundType';
import { ServerCommands } from './serverCommands';
import type { ShellExecuteAllResult } from '../types/playgroundType';

const log = createLogger('LanguageServerController');
let socket: WebSocket | null;

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
        options: debugOptions
      }
    };

    // Hijacks all LSP logs and redirect them to a specific port through WebSocket connection
    const channel = vscode.window.createOutputChannel(
      'MongoDB Language Server'
    );
    let logInspector = '';

    const websocketOutputChannel = {
      name: 'websocket',
      // Only append the logs but send them later
      append(value: string) {
        logInspector += value;
      },
      appendLine(value: string) {
        logInspector += value;
        channel.appendLine(logInspector);

        // Don't send logs until WebSocket initialization
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(logInspector);
        }

        logInspector = '';
      }
    } as OutputChannel;

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for mongodb documents
      documentSelector: [
        { scheme: 'untitled', language: 'mongodb' },
        { scheme: 'file', language: 'mongodb' }
      ],
      synchronize: {
        // Notify the server about file changes in the workspace
        fileEvents: workspace.createFileSystemWatcher('**/*')
      },
      // Attach WebSocket OutputChannel
      outputChannel: websocketOutputChannel
    };

    log.info('Creating MongoDB Language Server', {
      serverOptions,
      clientOptions
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
    // Start the client. This will also launch the server
    const disposable = this._client.start();

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    this._context.subscriptions.push(disposable);

    // Subscribe on notifications from the server when the client is ready
    await this._client.onReady();
    await this._client.sendRequest(
      ServerCommands.SET_EXTENSION_PATH,
      this._context.extensionPath
    );

    this._client.onNotification('showInformationMessage', (messsage) => {
      vscode.window.showInformationMessage(messsage);
    });

    this._client.onNotification('showErrorMessage', (messsage) => {
      vscode.window.showErrorMessage(messsage);
    });
  }

  deactivate(): void {
    if (!this._client) {
      return undefined;
    }

    // Stop the language server
    this._client.stop();
  }

  async executeAll(codeToEvaluate: string): Promise<ShellExecuteAllResult> {
    this._isExecutingInProgress = true;

    await this._client.onReady();
    // Instantiate a new CancellationTokenSource object
    // that generates a cancellation token for each run of a playground
    this._source = new CancellationTokenSource();

    // Send a request with a cancellation token
    // to the language server server to execute scripts from a playground
    // and return results to the playground controller when ready
    const result: ShellExecuteAllResult = await this._client.sendRequest(
      ServerCommands.EXECUTE_ALL_FROM_PLAYGROUND,
      {
        codeToEvaluate
      } as PlaygroundExecuteParameters,
      this._source.token
    );

    this._isExecutingInProgress = false;

    return result;
  }

  async connectToServiceProvider(params: {
    connectionString?: string;
    connectionOptions?: EJSON.SerializableTypes;
  }): Promise<void> {
    await this._client.onReady();
    await this._client.sendRequest(
      ServerCommands.CONNECT_TO_SERVICE_PROVIDER,
      params
    );
  }

  async disconnectFromServiceProvider(): Promise<void> {
    await this._client.onReady();
    await this._client.sendRequest(
      ServerCommands.DISCONNECT_TO_SERVICE_PROVIDER
    );
  }

  startStreamLanguageServerLogs(): Promise<boolean> {
    const socketPort = workspace
      .getConfiguration('languageServerExample')
      .get('port', 7000);

    socket = new WebSocket(`ws://localhost:${socketPort}`);

    return Promise.resolve(true);
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
