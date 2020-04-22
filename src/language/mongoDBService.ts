import { CompletionItemKind, CancellationToken } from 'vscode-languageserver';
import { Worker as WorkerThreads } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider } from '@mongosh/service-provider-server';
import * as util from 'util';

const path = require('path');

export default class MongoDBService {
  _serviceProvider?: CliServiceProvider;
  _runtime?: ElectronRuntime;
  _connection: any;
  _connectionString?: string;
  _connectionOptions?: any;
  _cachedFields: any;

  constructor(connection) {
    this._connection = connection;
    this._cachedFields = {};
  }

  get connectionString() {
    return this._connectionString;
  }

  get connectionOptions() {
    return this._connectionOptions;
  }

  async connectToServiceProvider(params): Promise<any> {
    this._connectionString = params.connectionString;
    this._connectionOptions = params.connectionOptions;

    try {
      this._serviceProvider = await CliServiceProvider.connect(
        params.connectionString,
        params.connectionOptions
      );
      this._runtime = new ElectronRuntime(this._serviceProvider);

      return Promise.resolve(true);
    } catch (error) {
      this._connection.console.log(`MONGOSH connect: ${util.inspect(error)}`);

      return Promise.resolve(false);
    }
  }

  async disconnectFromServiceProvider(): Promise<any> {
    this._connectionString = undefined;
    this._connectionOptions = undefined;
    this._runtime = undefined;

    return Promise.resolve(false);
  }

  executeAll(codeToEvaluate, token: CancellationToken): Promise<any> {
    return new Promise((resolve, reject) => {
      // Use Node worker threads to run a playground to be able to cancel infinite loops.
      //
      // There is an issue with support for `.ts` files.
      // Trying to run a `.ts` file in a worker thread returns the error:
      // `The worker script extension must be “.js” or “.mjs”. Received “.ts”`
      // As a workaround require `.js` file from the out folder.
      //
      // TODO: After webpackifying the extension replace
      // the workaround with some similar 3rd-party plugin.
      const worker = new WorkerThreads(path.resolve(__dirname, 'worker.js'), {
        // The workerData parameter sends data to the created worker.
        workerData: {
          codeToEvaluate: codeToEvaluate,
          connectionString: this._connectionString,
          connectionOptions: this._connectionOptions
        }
      });

      // Evaluate runtime in the worker thread.
      worker.postMessage('executeAll');

      // Listen for results from the worker thread.
      worker.on('message', ([error, result]) => {
        if (error) {
          this._connection.console.log(
            `MONGOSH execute all body: ${codeToEvaluate}`
          );
          this._connection.console.log(
            `MONGOSH execute all response: ${util.inspect(error)}`
          );
          this._connection.sendNotification('showErrorMessage', error.message);
        }

        worker.terminate().then(() => {
          return resolve(result);
        });
      });

      // Listen for cancellation request from the language server client.
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
        // in the worker thread as soon as possible.
        worker.terminate().then((status) => {
          this._connection.console.log(
            `Playground canceled with status: ${status}`
          );

          return resolve([]);
        });
      });
    });
  }

  // Use mongosh parser for shell API symbols/methods completion.
  // The parser requires the text before the current character.
  // Not the whole text from the editor.
  provideCompletionItems(textBeforeCurrentSymbol: string): Promise<[]> {
    return new Promise(async (resolve) => {
      let mongoshCompletions: any;

      if (!textBeforeCurrentSymbol || !this._runtime) {
        return resolve([]);
      }

      try {
        mongoshCompletions = await this._runtime?.getCompletions(
          textBeforeCurrentSymbol
        );
      } catch (error) {
        this._connection.console.log(
          `MONGOSH completion: ${util.inspect(error)}`
        );

        return resolve([]);
      }

      if (
        !mongoshCompletions ||
        !Array.isArray(mongoshCompletions) ||
        mongoshCompletions.length === 0
      ) {
        return resolve([]);
      }

      // Convert Completion[] format returned by `mongosh`
      // to CompletionItem[] format required by VSCode.
      mongoshCompletions = mongoshCompletions.map((item) => {
        // The runtime.getCompletions() function returns complitions including the user input.
        // Slice the user input and show only suggested keywords to complete the query.
        const index = item.completion.indexOf(textBeforeCurrentSymbol);
        const newTextToComplete = `${item.completion.slice(
          0,
          index
        )}${item.completion.slice(index + textBeforeCurrentSymbol.length)}`;
        const label: string =
          index === -1 ? item.completion : newTextToComplete;

        return {
          label,
          kind: CompletionItemKind.Text
        };
      });

      return resolve(mongoshCompletions);
    });
  }
}
