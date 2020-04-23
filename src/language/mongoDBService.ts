import { CompletionItemKind, CancellationToken } from 'vscode-languageserver';
import { Worker as WorkerThreads } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider } from '@mongosh/service-provider-server';
import * as util from 'util';

const path = require('path');
const esprima = require('esprima');
const estraverse = require('estraverse');

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
    this._serviceProvider = undefined;
    this._runtime = undefined;
    this._connectionString = params.connectionString;
    this._connectionOptions = params.connectionOptions;

    if (!this._connectionString) {
      return Promise.resolve(false);
    }

    try {
      this._serviceProvider = await CliServiceProvider.connect(
        this._connectionString,
        this._connectionOptions
      );
      this._runtime = new ElectronRuntime(this._serviceProvider);

      return Promise.resolve(true);
    } catch (error) {
      this._connection.console.log(
        `MONGOSH connect error: ${util.inspect(error)}`
      );

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
    this._cachedFields = {};

    return new Promise((resolve) => {
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

      this._connection.console.log(
        `MONGOSH execute all body: "${codeToEvaluate}"`
      );

      // Evaluate runtime in the worker thread.
      worker.postMessage('executeAll');

      // Listen for results from the worker thread.
      worker.on('message', ([error, result]) => {
        if (error) {
          this._connection.console.log(
            `MONGOSH execute all error: ${util.inspect(error)}`
          );
          this._connection.sendNotification('showErrorMessage', error.message);
        }

        worker.terminate().then(() => {
          return resolve(result);
        });
      });

      // Listen for cancellation request from the language server client.
      token.onCancellationRequested(() => {
        this._connection.console.log('PLAYGROUND cancellation requested');
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
            `PLAYGROUND canceled with status: ${status}`
          );

          return resolve([]);
        });
      });
    });
  }

  // Use mongosh parser for shell API symbols/methods completion.
  // The parser requires the text before the current character.
  // Not the whole text from the editor.
  getShellCompletionItems(textBeforeCurrentSymbol: string): Promise<[]> {
    return new Promise(async (resolve) => {
      let mongoshCompletions: any;

      if (!textBeforeCurrentSymbol || !this._runtime) {
        return resolve([]);
      }

      try {
        this._connection.console.log(
          `MONGOSH completion body: "${textBeforeCurrentSymbol}"`
        );
        mongoshCompletions = await this._runtime?.getCompletions(
          textBeforeCurrentSymbol
        );
      } catch (error) {
        this._connection.console.log(
          `MONGOSH completion error: ${util.inspect(error)}`
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

  // Use esprima parser for fields completion.
  // The parser requires the all text from the editor to build AST.
  // Not the current character as for mongosh parser.
  getFieldsCompletionItems(textAll: string, position): Promise<[]> {
    return new Promise(async (resolve) => {
      const dataFromAST = this.parseAST(textAll, position);
      const databaseName = dataFromAST.databaseName;
      const collectionName = dataFromAST.collectionName;
      const isObjectKey = dataFromAST.isObjectKey;

      if (databaseName && collectionName) {
        const namespace = `${databaseName}.${collectionName}`;

        if (isObjectKey) {
          if (!this._cachedFields[namespace]) {
            this._cachedFields[namespace] = await this.getFieldsFromSchema(
              databaseName,
              collectionName
            );
          }

          return resolve(this._cachedFields[namespace]);
        }
      }

      return resolve([]);
    });
  }

  checkHasDatabaseName(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === esprima.Syntax.Literal &&
      (currentPosition.line >= node.loc.start.line ||
        (currentPosition.line === node.loc.start.line - 1 &&
          currentPosition.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  checkHasCollectionName(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      node.object.name === 'db' &&
      (currentPosition.line >= node.loc.start.line ||
        (currentPosition.line === node.loc.start.line - 1 &&
          currentPosition.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  checkIsObjectKey(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      currentPosition.line === node.loc.end.line - 1 &&
      currentPosition.character === node.loc.end.column - 1
    ) {
      return true;
    }

    return false;
  }

  parseAST(
    textAll,
    position
  ): {
    databaseName: string | null;
    collectionName: string | null;
    isObjectKey: boolean;
  } {
    let databaseName = null;
    let collectionName = null;
    let isObjectKey = false;

    try {
      this._connection.console.log(
        `ESPRIMA symbol position: ${util.inspect(position)}`
      );
      this._connection.console.log(`ESPRIMA completion body: "${textAll}"`);

      const ast = esprima.parseScript(textAll, { loc: true });

      estraverse.traverse(ast, {
        enter: (node) => {
          if (
            node.type === esprima.Syntax.CallExpression &&
            this.checkHasDatabaseName(node, position)
          ) {
            databaseName = node.arguments[0].value;
          }

          if (
            node.type === esprima.Syntax.MemberExpression &&
            this.checkHasCollectionName(node, position)
          ) {
            collectionName = node.property.name;
          }

          if (
            node.type === esprima.Syntax.ObjectExpression &&
            this.checkIsObjectKey(node, position)
          ) {
            isObjectKey = true;
          }
        }
      });
    } catch (error) {
      this._connection.console.log(`ESPRIMA error: ${util.inspect(error)}`);
    }

    // this._connection.console.log(`'databaseName: ${databaseName}'`);
    // this._connection.console.log(`'collectionName: ${collectionName}'`);
    // this._connection.console.log(`'isObjectKey: ${isObjectKey}'`);

    return { databaseName, collectionName, isObjectKey };
  }

  updatedCurrentSessionFields(fields): void {
    this._cachedFields = fields ? fields : {};
  }

  getFieldsFromSchema(
    databaseName: string,
    collectionName: string
  ): Promise<any> {
    return new Promise((resolve) => {
      const namespace = `${databaseName}.${collectionName}`;
      const worker = new WorkerThreads(path.resolve(__dirname, 'worker.js'), {
        // The workerData parameter sends data to the created worker
        workerData: {
          connectionString: this._connectionString,
          connectionOptions: this._connectionOptions,
          databaseName,
          collectionName
        }
      });

      this._connection.console.log(`SCHEMA for namespace: ${namespace}`);

      // Evaluate runtime in the worker thread
      worker.postMessage('getFieldsFromSchema');

      // Listen for results from the worker thread
      worker.on('message', ([error, fields]) => {
        let result = [];

        if (error) {
          this._connection.console.log(`SCHEMA error: ${util.inspect(error)}`);
        } else {
          this._connection.console.log(
            `SCHEMA response: ${util.inspect(fields)}`
          );
        }

        worker.terminate().then(() => {
          return resolve(fields ? fields : []);
        });
      });
    });
  }
}
