import * as vscode from 'vscode';
import * as path from 'path';
import type { MongoClientOptions } from 'mongodb';
import type {
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node';
import {
  LanguageClient,
  TransportKind,
  CancellationTokenSource,
} from 'vscode-languageclient/node';
import type { ExtensionContext } from 'vscode';
import { workspace } from 'vscode';

import { createLogger } from '../logging';
import type {
  PlaygroundEvaluateParams,
  ShellEvaluateResult,
  ExportToLanguageMode,
  ExportToLanguageNamespace,
  PlaygroundTextAndSelection,
} from '../types/playgroundType';
import type { ClearCompletionsCache } from '../types/completionsCache';
import { ServerCommands } from './serverCommands';

const log = createLogger('language server controller');

/**
 * This controller manages the language server and client.
 */
export default class LanguageServerController {
  _context: ExtensionContext;
  _source?: CancellationTokenSource;
  _isExecutingInProgress = false;
  _client: LanguageClient;
  _currentConnectionId: string | null = null;
  _currentConnectionString?: string;
  _currentConnectionOptions?: MongoClientOptions;

  constructor(context: ExtensionContext) {
    this._context = context;

    // The server is implemented in node.
    const languageServerPath = path.join(
      context.extensionPath,
      'dist',
      'languageServer.js'
    );

    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode
    // so VS Code can attach to the server for debugging.
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used.
    // Otherwise the run options are used.
    const serverOptions: ServerOptions = {
      run: { module: languageServerPath, transport: TransportKind.ipc },
      debug: {
        module: languageServerPath,
        transport: TransportKind.ipc,
        options: debugOptions,
      },
    };

    const languageServerId = 'mongodbLanguageServer';
    const languageServerName = 'MongoDB Language Server';
    // Define the document patterns to register the language server for.
    const documentSelector = [
      { pattern: '**/*.mongodb.js' },
      { pattern: '**/*.mongodb' },
    ];
    // Options to control the language client.
    const clientOptions: LanguageClientOptions = {
      documentSelector: documentSelector,
      synchronize: {
        // Notify the server about file changes in the workspace.
        fileEvents: workspace.createFileSystemWatcher('**/*'),
      },
      outputChannel: vscode.window.createOutputChannel(languageServerName),
    };

    log.info('Creating MongoDB Language Server...', {
      extensionPath: context.extensionPath,
      languageServer: {
        id: languageServerId,
        name: languageServerName,
        path: languageServerPath,
        documentSelector: JSON.stringify(documentSelector),
      },
    });

    // Create the language server client.
    this._client = new LanguageClient(
      languageServerId,
      languageServerName,
      serverOptions,
      clientOptions
    );
  }

  async startLanguageServer(): Promise<void> {
    log.info('Starting MongoDB Language Server...');
    // Start the client. This will also launch the server.
    await this._client.start();

    // Push the disposable client to the context's subscriptions so that the
    // client can be deactivated on extension deactivation.
    if (!this._context.subscriptions.includes(this._client)) {
      this._context.subscriptions.push(this._client);
    }

    // Subscribe on notifications from the server when the client is ready.
    // If the connection to server got closed, server will restart,
    // so we need to re-send extensionPath and the active connection.
    // https://jira.mongodb.org/browse/VSCODE-448
    this._client.onNotification(ServerCommands.MONGODB_SERVICE_CREATED, () => {
      const msg = this._currentConnectionId
        ? 'MongoDBService restarted because of some problem'
        : 'MongoDBService is ready';
      log.info(
        `${msg}. Sending default settings... ${JSON.stringify({
          extensionPath: this._context.extensionPath,
          connectionId: this._currentConnectionId,
          hasConnectionString: !!this._currentConnectionString,
          hasConnectionOptions: !!this._currentConnectionOptions,
        })}`
      );
      void this._client.sendRequest(ServerCommands.INITIALIZE_MONGODB_SERVICE, {
        extensionPath: this._context.extensionPath,
        connectionId: this._currentConnectionId,
        connectionString: this._currentConnectionString,
        connectionOptions: this._currentConnectionOptions,
      });
      if (this._currentConnectionId) {
        void vscode.window.showErrorMessage(
          'Connection to playground got closed. Server will restart'
        );
      }
    });

    this._client.onNotification(
      ServerCommands.SHOW_INFO_MESSAGE,
      (messsage) => {
        log.info('The info message shown to a user', messsage);
        void vscode.window.showInformationMessage(messsage);
      }
    );

    this._client.onNotification(
      ServerCommands.SHOW_ERROR_MESSAGE,
      (messsage) => {
        log.info('The error message shown to a user', messsage);
        void vscode.window.showErrorMessage(messsage);
      }
    );
  }

  deactivate(): Thenable<void> | undefined {
    log.info('Deactivating MongoDB Language Server...');
    if (!this._client) {
      log.info('The MongoDB Language Server client is not found');
      return undefined;
    }

    // Stop the language server.
    return this._client.stop();
  }

  async evaluate(
    playgroundExecuteParameters: PlaygroundEvaluateParams
  ): Promise<ShellEvaluateResult> {
    log.info('Running a playground...', {
      connectionId: playgroundExecuteParameters.connectionId,
      inputLength: playgroundExecuteParameters.codeToEvaluate.length,
    });
    this._isExecutingInProgress = true;

    // Instantiate a new CancellationTokenSource object
    // that generates a cancellation token for each run of a playground.
    this._source = new CancellationTokenSource();

    // Send a request with a cancellation token
    // to the language server instance to execute scripts from a playground
    // and return results to the playground controller when ready.
    const res: ShellEvaluateResult = await this._client.sendRequest(
      ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND,
      playgroundExecuteParameters,
      this._source.token
    );

    this._isExecutingInProgress = false;

    log.info('Evaluate response', {
      namespace: res?.result?.namespace,
      type: res?.result?.type,
      outputLength: JSON.stringify(res?.result?.content || '').length,
      language: res?.result?.language,
    });

    return res;
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

  async activeConnectionChanged({
    connectionId,
    connectionString,
    connectionOptions,
  }: {
    connectionId: null | string;
    connectionString?: string;
    connectionOptions?: MongoClientOptions;
  }): Promise<void> {
    log.info('Changing MongoDBService active connection...', { connectionId });

    this._currentConnectionId = connectionId;
    this._currentConnectionString = connectionString;
    this._currentConnectionOptions = connectionOptions;

    const res = await this._client.sendRequest(
      ServerCommands.ACTIVE_CONNECTION_CHANGED,
      {
        connectionId,
        connectionString,
        connectionOptions,
      }
    );
    log.info('MongoDBService active connection has changed', res);
  }

  async resetCache(clear: ClearCompletionsCache): Promise<void> {
    log.info('Reseting MongoDBService cache...', clear);
    await this._client.sendRequest(
      ServerCommands.CLEAR_CACHED_COMPLETIONS,
      clear
    );
  }

  cancelAll(): void {
    log.info('Canceling a playground...');
    // Send a request for cancellation. As a result
    // the associated CancellationToken will be notified of the cancellation,
    // the onCancellationRequested event will be fired,
    // and IsCancellationRequested will return true.
    if (this._isExecutingInProgress) {
      this._source?.cancel();
      this._isExecutingInProgress = false;
    }
  }

  async updateCurrentSessionFields(params): Promise<void> {
    await this._client.sendRequest(
      ServerCommands.UPDATE_CURRENT_SESSION_FIELDS,
      params
    );
  }
}
