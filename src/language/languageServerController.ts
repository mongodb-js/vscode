import * as vscode from 'vscode';
import * as path from 'path';
import { workspace, ExtensionContext, OutputChannel } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  CancellationTokenSource,
} from 'vscode-languageclient';
import * as WebSocket from 'ws';

import ConnectionController from '../connectionController';
import { createLogger } from '../logging';

const log = createLogger('LanguageServerController');
let socket: WebSocket | null;

/**
 * This controller manages the language server and client.
 */
export default class LanguageServerController {
  _connectionController?: ConnectionController;
  _source?: CancellationTokenSource;
  client: LanguageClient;

  constructor(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = path.join(
      context.extensionPath,
      'out',
      'language',
      'server.js'
    );

    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
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
      },
    } as OutputChannel;

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for mongodb documents
      documentSelector: [
        { scheme: 'untitled', language: 'mongodb' },
        { scheme: 'file', language: 'mongodb' },
      ],
      synchronize: {
        // Notify the server about file changes in the workspace
        fileEvents: workspace.createFileSystemWatcher('**/*'),
      },
      // Attach WebSocket OutputChannel
      outputChannel: websocketOutputChannel,
    };

    log.info('Creating MongoDB Language Server', {
      serverOptions,
      clientOptions,
    });

    // Create the language server client
    this.client = new LanguageClient(
      'mongodbLanguageServer',
      'MongoDB Language Server',
      serverOptions,
      clientOptions
    );
  }

  async activate(): Promise<any> {
    // Start the client. This will also launch the server
    this.client.start();

    // Subscribe on notifications from the server when the client is ready
    await this.client.onReady().then(() => {
      this.client.onNotification('showInformationMessage', (messsage) => {
        vscode.window.showInformationMessage(messsage);
      });

      this.client.onNotification('showErrorMessage', (messsage) => {
        vscode.window.showErrorMessage(messsage);
      });
    });
  }

  deactivate(): void {
    // Stop the language server
    this.client.stop();
  }

  executeAll(codeToEvaluate: string): Promise<any> {
    return this.client.onReady().then(async () => {
      // Instantiate a new CancellationTokenSource object
      // that generates a cancellation token for each run of a playground
      this._source = new CancellationTokenSource();

      // Send a request with a cancellation token
      // to the language server server to execute scripts from a playground
      // and return results to the playground controller when ready
      return this.client.sendRequest(
        'executeAll',
        codeToEvaluate,
        this._source.token
      );
    });
  }

  connect(params: {
    connectionString?: string | null;
    connectionOptions?: any;
  }): Promise<any> {
    return this.client.onReady().then(async () => {
      return this.client.sendRequest('connect', params);
    });
  }

  startStreamLanguageServerLogs(): Promise<boolean> {
    const socketPort = workspace
      .getConfiguration('languageServerExample')
      .get('port', 7000);

    socket = new WebSocket(`ws://localhost:${socketPort}`);

    return Promise.resolve(true);
  }

  cancelAll(): Promise<boolean> {
    return new Promise((resolve) => {
      // Send a request for cancellation. As a result
      // the associated CancellationToken will be notified of the cancellation,
      // the onCancellationRequested event will be fired,
      // and IsCancellationRequested will return true.
      this._source?.cancel();

      return resolve(true);
    });
  }
}
