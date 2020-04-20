import {
  CompletionItemKind,
  TextDocumentPositionParams,
  CancellationToken,
  TextDocument,
} from 'vscode-languageserver';
import { Worker as WorkerThreads } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider } from '@mongosh/service-provider-server';

const path = require('path');

export default class MongoDBService {
  _serviceProvider?: CliServiceProvider;
  _runtime?: ElectronRuntime;
  _connection: any;
  _connectionId = null;
  _connectionString = '';
  _connectionOptions = {};
  _cachedFields = {};

  constructor(params) {
    this._connectionId = params.connectionId;
    this._connectionString = params.connectionString;
    this._connectionOptions = params.connectionOptions
      ? params.connectionOptions
      : {};
    this._connection = params.connection;
  }

  async connectToCliServiceProvider(): Promise<any> {
    try {
      this._serviceProvider = await CliServiceProvider.connect(
        this._connectionString,
        this._connectionOptions
      );
      this._runtime = new ElectronRuntime(this._serviceProvider);
    } catch (error) {
      Promise.reject(`'CliServiceProvider: ${error}'`);
    }
  }

  executeAll(codeToEvaluate: string, token: CancellationToken): Promise<any> {
    return new Promise((resolve) => {
      // Use Node worker threads to isolate each run of a playground
      // to be able to cancel evaluation of infinite loops.
      //
      // There is an issue with support for `.ts` files.
      // Trying to run a `.ts` file in a worker thread results in error:
      // `The worker script extension must be “.js” or “.mjs”. Received “.ts”`
      // As a workaround require `.js` file from the out folder.
      //
      // TODO: After webpackifying the extension replace
      // the workaround with some similar 3rd-party plugin
      const worker = new WorkerThreads(path.resolve(__dirname, 'worker.js'), {
        // The workerData parameter sends data to the created worker
        workerData: {
          codeToEvaluate,
          connectionString: this._connectionString,
          connectionOptions: this._connectionOptions,
        },
      });

      // Evaluate runtime in the worker thread
      worker.postMessage('executeAll');

      // Listen for results from the worker thread
      worker.on('message', ([error, result]) => {
        if (error) {
          this._connection.sendNotification('showErrorMessage', error.message);
        }

        worker.terminate(); // Close the worker thread

        return resolve(result);
      });

      // Listen for cancellation request from the language server client
      token.onCancellationRequested(() => {
        this._connection.console.log('Playground cancellation requested');
        this._connection.sendNotification(
          'showInformationMessage',
          'The running playground operation was canceled.'
        );

        // If there is a situation that mongoClient is unresponsive,
        // try to close mongoClient after each runtime evaluation
        // and after the cancelation of the runtime
        // to make sure that all resources are free and can be used with a new request.
        //
        // (serviceProvider as any)?.mongoClient.close(false);
        //
        // The mongoClient.close method closes the underlying connector,
        // which in turn closes all open connections.
        // Once called, this mongodb instance can no longer be used.
        //
        // See: https://github.com/mongodb-js/vscode/pull/54

        // Stop the worker and all JavaScript execution
        // in the worker thread as soon as possible
        worker.terminate().then((status) => {
          this._connection.console.log(
            `Playground canceled with status: ${status}`
          );
        });
      });
    });
  }

  // Request the completion items from `mongosh` based on the current input.
  provideCompletionItems(
    params: TextDocumentPositionParams,
    textDocument?: TextDocument
  ): Promise<[]> {
    return new Promise(async (resolve) => {
      // Use the `textBeforeCurrentSymbol` variable for the `mongosh` parser
      // since it requires only left-hand side text
      // We use `mongosh` parser for shell API symbols/methods completion
      const textBeforeCurrentSymbol = textDocument?.getText({
        start: { line: 0, character: 0 },
        end: params.position,
      });

      if (!textBeforeCurrentSymbol) {
        return resolve([]);
      }

      // If the current node is not object key, try to get shell symbols
      let mongoshCompletions: any;

      try {
        mongoshCompletions = await this._runtime?.getCompletions(
          textBeforeCurrentSymbol
        );
      } catch (error) {
        this._connection.console.log(`'MongoDB Shell Runtime: ${error}'`);
      }

      if (
        mongoshCompletions &&
        Array.isArray(mongoshCompletions) &&
        mongoshCompletions.length > 0
      ) {
        // Convert Completion[] format returned by `mongosh`
        // to CompletionItem[] format required by VSCode
        mongoshCompletions = mongoshCompletions.map((item) => {
          // The runtime.getCompletions() function returns complitions including the user input.
          // Slice the user input and show only suggested keywords to complete the query.
          const index = item.completion.indexOf(textBeforeCurrentSymbol);
          const newTextToComplete = `${item.completion.slice(
            0,
            index
          )}${item.completion.slice(index + textBeforeCurrentSymbol.length)}`;
          const label = index === -1 ? item.completion : newTextToComplete;

          return {
            label,
            kind: CompletionItemKind.Text,
          };
        });

        return resolve(mongoshCompletions);
      }
    });
  }
}
