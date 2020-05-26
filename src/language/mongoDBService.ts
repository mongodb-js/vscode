import { CompletionItemKind, CancellationToken } from 'vscode-languageserver';
import { Worker as WorkerThreads } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider } from '@mongosh/service-provider-server';
import { signatures } from '@mongosh/shell-api';
import * as util from 'util';
import { Visitor } from './visitor';

import { ServerCommands, PlaygroundRunParameters } from './serverCommands';

const path = require('path');
const fs = require('fs');

export const languageServerWorkerFileName = 'languageServerWorker.js';

type SslFileOptions = {
  sslCA?: string;
  sslKey?: string;
  sslCert?: string;
};

export default class MongoDBService {
  _serviceProvider?: CliServiceProvider;
  _runtime?: ElectronRuntime;
  _connection: any;
  _connectionString?: string;
  _connectionOptions?: object;
  _cachedFields: object;
  _cachedDatabases: [];
  _cachedCollections: object;
  _cachedShellSymbols: object;
  _extensionPath?: string;
  _visitor: Visitor;

  constructor(connection) {
    this._connection = connection;
    this._cachedFields = {};
    this._cachedDatabases = [];
    this._cachedCollections = [];
    this._cachedShellSymbols = this.getShellCompletionItems();
    this._visitor = new Visitor();
  }

  // ------ CONNECTION ------ //
  public get connectionString(): string | undefined {
    return this._connectionString;
  }

  public get connectionOptions(): object | undefined {
    return this._connectionOptions;
  }

  private isSslConnection(connectionOptions: any): boolean {
    return !!(
      connectionOptions.sslCA ||
      connectionOptions.sslCert ||
      connectionOptions.sslPass
    );
  }

  private loadSslOptionsFromFile(connectionOptions): SslFileOptions {
    const sslOptions: SslFileOptions = {};

    if (connectionOptions.sslCA) {
      sslOptions.sslCA = fs.readFileSync(`/${connectionOptions.sslCA[0]}`);
    }
    if (connectionOptions.sslKey) {
      sslOptions.sslKey = fs.readFileSync(`/${connectionOptions.sslKey[0]}`);
    }
    if (connectionOptions.sslCert) {
      sslOptions.sslCert = fs.readFileSync(`/${connectionOptions.sslCert[0]}`);
    }

    return sslOptions;
  }

  public async connectToServiceProvider(params: {
    connectionString?: string;
    connectionOptions?: any;
    extensionPath: string;
  }): Promise<boolean> {
    this.clearCurrentSessionConnection();
    this.clearCurrentSessionFields();
    this.clearCurrentSessionDatabases();
    this.clearCurrentSessionCollections();

    this._connectionString = params.connectionString;
    this._connectionOptions = params.connectionOptions;
    this._extensionPath = params.extensionPath;

    if (!this._connectionString) {
      return Promise.resolve(false);
    }

    if (this.isSslConnection(this._connectionOptions)) {
      this._connectionOptions = {
        ...this._connectionOptions,
        ...this.loadSslOptionsFromFile(this._connectionOptions)
      };
    }

    try {
      this._serviceProvider = await CliServiceProvider.connect(
        this._connectionString,
        this._connectionOptions
      );
      this._runtime = new ElectronRuntime(this._serviceProvider);
      this.getDatabasesCompletionItems();

      return Promise.resolve(true);
    } catch (error) {
      this._connection.console.log(
        `MONGOSH connect error: ${util.inspect(error)}`
      );

      return Promise.resolve(false);
    }
  }

  public async disconnectFromServiceProvider(): Promise<boolean> {
    this.clearCurrentSessionConnection();
    this.clearCurrentSessionFields();
    this.clearCurrentSessionDatabases();
    this.clearCurrentSessionCollections();

    return Promise.resolve(false);
  }

  // ------ EXECUTION ------ //
  public executeAll(
    executionParameters: PlaygroundRunParameters,
    token: CancellationToken
  ): Promise<any> {
    this.clearCurrentSessionFields();

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
      const worker = new WorkerThreads(
        path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
        {
          // The workerData parameter sends data to the created worker.
          workerData: {
            codeToEvaluate: executionParameters.codeToEvaluate,
            connectionString: this._connectionString,
            connectionOptions: this._connectionOptions
          }
        }
      );

      this._connection.console.log(
        `MONGOSH execute all body: "${executionParameters.codeToEvaluate}"`
      );

      // Evaluate runtime in the worker thread.
      worker.postMessage(ServerCommands.EXECUTE_ALL_FROM_PLAYGROUND);

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

  // ------ GET DATA FOR COMPLETION ------ //
  public getDatabasesCompletionItems(): void {
    const worker = new WorkerThreads(
      path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
      {
        workerData: {
          connectionString: this._connectionString,
          connectionOptions: this._connectionOptions
        }
      }
    );

    this._connection.console.log('MONGOSH get list databases...');
    worker.postMessage(ServerCommands.GET_LIST_DATABASES);

    worker.on('message', ([error, result]) => {
      if (error) {
        this._connection.console.log(
          `MONGOSH get list databases error: ${util.inspect(error)}`
        );
      }

      worker.terminate().then(() => {
        this._connection.console.log(
          `MONGOSH found ${result.length} databases`
        );
        this.updateCurrentSessionDatabases(result);
      });
    });
  }

  public getCollectionsCompletionItems(databaseName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const worker = new WorkerThreads(
        path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
        {
          workerData: {
            connectionString: this._connectionString,
            connectionOptions: this._connectionOptions,
            databaseName
          }
        }
      );

      this._connection.console.log('MONGOSH get list collections...');
      worker.postMessage(ServerCommands.GET_LIST_COLLECTIONS);

      worker.on('message', ([error, result]) => {
        if (error) {
          this._connection.console.log(
            `MONGOSH get list collections error: ${util.inspect(error)}`
          );
        }

        worker.terminate().then(() => {
          this._connection.console.log(
            `MONGOSH found ${result.length} collections`
          );
          this.updateCurrentSessionCollections(databaseName, result);

          return resolve(true);
        });
      });
    });
  }

  public getFieldsCompletionItems(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const namespace = `${databaseName}.${collectionName}`;
      const worker = new WorkerThreads(
        path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
        {
          workerData: {
            connectionString: this._connectionString,
            connectionOptions: this._connectionOptions,
            databaseName,
            collectionName
          }
        }
      );

      this._connection.console.log(`SCHEMA for namespace: "${namespace}"`);
      worker.postMessage(ServerCommands.GET_FIELDS_FROM_SCHEMA);

      worker.on('message', ([error, fields]) => {
        if (error) {
          this._connection.console.log(`SCHEMA error: ${util.inspect(error)}`);
        }

        worker.terminate().then(() => {
          this._connection.console.log(`SCHEMA found ${fields.length} fields`);
          this.updateCurrentSessionFields(namespace, fields);

          return resolve(true);
        });
      });
    });
  }

  // Get shell API symbols/methods completion from mongosh.
  private getShellCompletionItems(): object {
    const shellSymbols = {};

    Object.keys(signatures).map((symbol) => {
      shellSymbols[symbol] = Object.keys(signatures[symbol].attributes).map(
        (item) => ({
          label: item,
          kind: CompletionItemKind.Method
        })
      );
    });

    return shellSymbols;
  }

  // ------ COMPLETION ------ //

  // Check if string is a valid property name
  private isValidPropertyName(str) {
    return /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str);
  }

  private prepareCollectionsItems(
    textFromEditor: string,
    collections: Array<any>,
    position: { line: number; character: number }
  ): any {
    if (!collections) {
      return [];
    }

    return collections.map((item) => {
      if (this.isValidPropertyName(item.name)) {
        return {
          label: item.name,
          kind: CompletionItemKind.Folder
        };
      }

      // Convert invalid property names to array-like format
      const filterText = textFromEditor.split('\n')[position.line];

      return {
        label: item.name,
        kind: CompletionItemKind.Folder,
        // Find the line with invalid property name
        filterText: [
          filterText.slice(0, position.character),
          `.${item.name}`,
          filterText.slice(position.character, filterText.length)
        ].join(''),
        textEdit: {
          range: {
            start: { line: position.line, character: 0 },
            end: {
              line: position.line,
              character: filterText.length
            }
          },
          // Replace with array-like format
          newText: [
            filterText.slice(0, position.character - 1),
            `['${item.name}']`,
            filterText.slice(position.character, filterText.length)
          ].join('')
        }
      };
    });
  }

  public provideCompletionItems(
    textFromEditor: string,
    position: { line: number; character: number }
  ): Promise<[]> {
    return new Promise(async (resolve) => {
      this._connection.console.log(
        `LS text from editor: ${util.inspect(textFromEditor)}`
      );
      this._connection.console.log(
        `LS current symbol position: ${util.inspect(position)}`
      );

      const state = this._visitor.parseAST(textFromEditor, position);

      this._connection.console.log(
        `VISITOR completion state: ${util.inspect(state)}`
      );

      if (state.databaseName && !this._cachedCollections[state.databaseName]) {
        await this.getCollectionsCompletionItems(state.databaseName);
      }

      if (state.databaseName && state.collectionName) {
        const namespace = `${state.databaseName}.${state.collectionName}`;

        if (!this._cachedFields[namespace]) {
          await this.getFieldsCompletionItems(
            state.databaseName,
            state.collectionName
          );
        }

        if (state.isObjectKey) {
          this._connection.console.log('VISITOR found field names completion');

          return resolve(this._cachedFields[namespace]);
        }
      }

      if (state.isShellMethod) {
        this._connection.console.log(
          'VISITOR found shell collection methods completion'
        );

        return resolve(this._cachedShellSymbols['Collection']);
      }

      if (state.isAggregationCursor) {
        this._connection.console.log(
          'VISITOR found shell aggregation cursor methods completion'
        );

        return resolve(this._cachedShellSymbols['AggregationCursor']);
      }

      if (state.isFindCursor) {
        this._connection.console.log(
          'VISITOR found shell cursor methods completion'
        );

        return resolve(this._cachedShellSymbols['Cursor']);
      }

      if (state.isDbCallExpression) {
        let dbCompletions: any = [...this._cachedShellSymbols['Database']];

        if (state.databaseName) {
          this._connection.console.log(
            'VISITOR found shell db methods and collection names completion'
          );

          const collectionCompletions = this.prepareCollectionsItems(
            textFromEditor,
            this._cachedCollections[state.databaseName],
            position
          );

          dbCompletions = dbCompletions.concat(collectionCompletions);
        } else {
          this._connection.console.log(
            'VISITOR found shell db methods completion'
          );
        }

        return resolve(dbCompletions);
      }

      if (state.isCollectionName && state.databaseName) {
        this._connection.console.log(
          'VISITOR found collection names completion'
        );

        const collectionCompletions = this.prepareCollectionsItems(
          textFromEditor,
          this._cachedCollections[state.databaseName],
          position
        );

        return resolve(collectionCompletions);
      }

      if (state.isUseCallExpression) {
        this._connection.console.log('VISITOR found database names completion');

        return resolve(this._cachedDatabases);
      }

      this._connection.console.log('VISITOR no completions');

      return resolve([]);
    });
  }

  // ------ CURRENT SESSION ------ //
  public clearCurrentSessionFields(): void {
    this._cachedFields = {};
  }

  public updateCurrentSessionFields(
    namespace: string,
    fields: [{ label: string; kind: number }]
  ): [] {
    if (!this._cachedFields[namespace]) {
      this._cachedFields[namespace] = {};
    }

    this._cachedFields[namespace] = fields;

    return this._cachedFields[namespace];
  }

  public clearCurrentSessionDatabases(): void {
    this._cachedDatabases = [];
  }

  public updateCurrentSessionDatabases(databases: any): void {
    this._cachedDatabases = databases ? databases : [];
  }

  public clearCurrentSessionCollections(): void {
    this._cachedCollections = {};
  }

  public updateCurrentSessionCollections(
    database: string,
    collections: any
  ): [] {
    if (database) {
      this._cachedCollections[database] = collections;

      return this._cachedFields[database];
    }

    return [];
  }

  public clearCurrentSessionConnection() {
    this._serviceProvider = undefined;
    this._runtime = undefined;
    this._connectionString = undefined;
    this._connectionOptions = undefined;
  }
}
