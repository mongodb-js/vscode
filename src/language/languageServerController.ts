import * as vscode from 'vscode';
import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';

import ConnectionController from '../connectionController';
import { createLogger } from '../logging';

const log = createLogger('LanguageServerController');

/**
 * This controller manages the language server and client.
 */
export default class LanguageServerController {
  _connectionController?: ConnectionController;
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

  executeAll(codeToEvaluate: string, connectionString: string, connectionOptions: any = {}): Promise<any> {
    return new Promise((resolve) => {
      this.client.onReady().then(() => {
        // Send a request to the language server server to execute scripts from a playground.
        // We do not wait for results here since the evaluation happens in worker threads
        // and the process can be killed at some point
        this.client.sendRequest(
          'executeAll',
          { codeToEvaluate, connectionString, connectionOptions }
        );
        // Listen for playground evaluation results form the language server server
        // and return results to the playground controller
        return this.client.onNotification('executeAllDone', (data) => {
          return resolve(data)
        });
      });
    });
  }

  cancelAll(): Promise<any> {
    // Send a request to the language server server to cancel all playground scripts
    return this.client.sendRequest('cancelAll');
  }
}
