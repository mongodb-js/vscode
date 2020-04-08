import * as vscode from 'vscode';
import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  CancellationTokenSource
} from 'vscode-languageclient';

import ConnectionController from '../connectionController';
import { createLogger } from '../logging';

const log = createLogger('LanguageServerController');

/**
 * This controller manages the language server and client.
 */
export default class LanguageServerController {
  _connectionController?: ConnectionController;
  _source?: CancellationTokenSource;
  client: LanguageClient;

  constructor(
    context: ExtensionContext,
    connectionController?: ConnectionController
  ) {
    this._connectionController = connectionController;

    // The server is implemented in node
    const serverModule = path.join(context.extensionPath, 'out', 'language', 'server.js');

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
        options: debugOptions
      }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for mongodb documents
      documentSelector: [
        { scheme: 'untitled', language: 'mongodb' },
        { scheme: 'file', language: 'mongodb' }
      ],
      synchronize: {
        // Notify the server about file changes to '.clientrc files contained in the workspace
        fileEvents: workspace.createFileSystemWatcher('**/*')
      }
    };

    log.info('Creating MongoDB Language Server', {
      serverOptions,
      clientOptions
    });

    // Create the language server client
    this.client = new LanguageClient(
      'mongodbLanguageServer',
      'MongoDB Language Server',
      serverOptions,
      clientOptions
    );
  }

  restart(): void {
    // Wait until deactivated and start the language server again
    this.deactivate().then(() => {
      this.activate();
    });
  }

  activate(): void {
    // Start the client. This will also launch the server
    this.client.start();
    // Subscribe on notifications from the server when the client is ready
    this.client.onReady().then(() => {
      this.client.onNotification('showInfoNotification', (messsage) => {
        vscode.window.showInformationMessage(messsage);
      });

      this.client.onNotification('restartNotification', () => {
        this.restart();
      });
    });
  }

  async deactivate(): Promise<any> {
    await this.client.stop();
  }

  executeAll(codeToEvaluate: string, connectionString: string, connectionOptions: any = {}): Thenable<any> | undefined {
    return this.client.onReady().then(async () => {
      // Instantiate a new CancellationTokenSource object
      // that generates a cancellation token for each run of a playground
      this._source = new CancellationTokenSource();

      // Pass the cancellation token to the server along with other attributes
      return await this.client.sendRequest(
        'executeAll',
        { codeToEvaluate, connectionString, connectionOptions },
        this._source.token
      );;
    });
  }

  cancelAll() {
    // Send a request for cancellation. As a result
    // the associated CancellationToken will be notified of the cancellation,
    // the onCancellationRequested event will be fired,
    // and IsCancellationRequested will return true.
    this._source?.cancel();
  }
}
