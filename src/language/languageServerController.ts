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
    context: vscode.ExtensionContext,
    connectionController?: ConnectionController
  ) {
    this._connectionController = connectionController;

    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
      context.extensionPath === 'TEST_FOLDER'
        ? path.join('..', '..', 'out', 'language', 'server.js')
        : path.join('out', 'language', 'server.js')
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
        options: debugOptions
      }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for plain text documents
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

    // Create the language client and start the client.
    this.client = new LanguageClient(
      'mongodbLanguageServer',
      'MongoDB Language Server',
      serverOptions,
      clientOptions
    );

    // Start the client. This will also launch the server
    this.client.start();
    this.client.onReady().then(() => {
      /**
       * TODO: Notification is for setup docs only.
       */
      this.client.onNotification('mongodbNotification', (messsage) => {
        vscode.window.showInformationMessage(messsage);
      });
    });
  }

  deactivate(): Thenable<void> | undefined {
    return this.client.stop();
  }

  executeAll(codeToEvaluate: string, connectionString: string, connectionOptions: any = {}): Thenable<any> | undefined {
    return this.client.onReady().then(() => {
      return this.client.sendRequest('executeAll', { codeToEvaluate, connectionString, connectionOptions });
    });
  }
}
