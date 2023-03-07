import * as util from 'util';
import {
  CompletionItemKind,
  CancellationToken,
  Connection,
  CompletionItem,
  MarkupContent,
  MarkupKind,
} from 'vscode-languageserver/node';
import type { MongoClientOptions } from 'mongodb';
import path from 'path';
import { signatures } from '@mongosh/shell-api';
import translator from '@mongosh/i18n';
import { Worker as WorkerThreads } from 'worker_threads';
import formatError from '../utils/formatError';
import { PrintableError } from '../utils/formatError';

import { ServerCommands } from './serverCommands';
import {
  ShellExecuteAllResult,
  PlaygroundExecuteParameters,
  ExportToLanguageMode,
  ExportToLanguageNamespace,
  PlaygroundTextAndSelection,
} from '../types/playgroundType';
import { Visitor } from './visitor';

export const languageServerWorkerFileName = 'languageServerWorker.js';

export type CollectionItem = {
  name: string;
  type?: string;
  options?: object;
  info?: { readOnly: boolean; uuid: object[] };
  idIndex?: { v: number; key: object[]; name: string; ns: string };
};

export type ShellCompletionItem = {
  [symbol: string]: CompletionItem[] | [];
};

export default class MongoDBService {
  _connection: Connection;
  _connectionId?: string;
  _connectionString?: string;
  _connectionOptions?: MongoClientOptions;
  _cachedDatabases: CompletionItem[] | [] = [];
  _cachedFields: { [namespace: string]: CompletionItem[] } | {} = {};
  _cachedCollections: { [database: string]: CollectionItem[] } | {} = {};
  _cachedShellSymbols: ShellCompletionItem;
  _extensionPath?: string;
  _visitor: Visitor;

  constructor(connection: Connection) {
    this._connection = connection;
    this._cachedShellSymbols = this._getShellCompletionItems();
    this._visitor = new Visitor(connection.console);
  }

  // ------ CONNECTION ------ //
  get connectionString(): string | undefined {
    return this._connectionString;
  }

  get connectionOptions(): MongoClientOptions | undefined {
    return this._connectionOptions;
  }

  setExtensionPath(extensionPath: string): void {
    if (!extensionPath) {
      this._connection.console.error(
        'Set extensionPath error: extensionPath is undefined'
      );
    } else {
      this._extensionPath = extensionPath;
    }
  }

  async connectToServiceProvider(params: {
    connectionId: string;
    connectionString: string;
    connectionOptions: MongoClientOptions;
  }): Promise<boolean> {
    this._clearCurrentSessionConnection();
    this._clearCurrentSessionFields();
    this._clearCurrentSessionDatabases();
    this._clearCurrentSessionCollections();

    this._connectionId = params.connectionId;
    this._connectionString = params.connectionString;
    this._connectionOptions = params.connectionOptions;

    if (!this._connectionString) {
      return Promise.resolve(false);
    }

    try {
      this._getDatabasesCompletionItems();

      return Promise.resolve(true);
    } catch (error) {
      this._connection.console.error(
        `MONGOSH connect error: ${util.inspect(error)}`
      );

      return Promise.resolve(false);
    }
  }

  disconnectFromServiceProvider(): void {
    this._clearCurrentSessionConnection();
    this._clearCurrentSessionFields();
    this._clearCurrentSessionDatabases();
    this._clearCurrentSessionCollections();
  }

  // ------ EXECUTION ------ //
  async executeAll(
    executionParameters: PlaygroundExecuteParameters,
    token: CancellationToken
  ): Promise<ShellExecuteAllResult | undefined> {
    this._clearCurrentSessionFields();

    return new Promise((resolve) => {
      if (!this._extensionPath) {
        this._connection.console.error(
          'MONGOSH execute all error: extensionPath is undefined'
        );

        return resolve(undefined);
      }

      if (this._connectionId !== executionParameters.connectionId) {
        void this._connection.sendNotification(
          ServerCommands.SHOW_ERROR_MESSAGE,
          "The playground's active connection does not match the extension's active connection. Please reconnect and try again."
        );

        return resolve(undefined);
      }

      try {
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
          path.resolve(
            this._extensionPath,
            'dist',
            languageServerWorkerFileName
          ),
          {
            // The workerData parameter sends data to the created worker.
            workerData: {
              codeToEvaluate: executionParameters.codeToEvaluate,
              connectionString: this._connectionString,
              connectionOptions: this._connectionOptions,
            },
          }
        );

        this._connection.console.log(
          `MONGOSH execute all body: "${executionParameters.codeToEvaluate}"`
        );

        // Evaluate runtime in the worker thread.
        worker.postMessage(ServerCommands.EXECUTE_ALL_FROM_PLAYGROUND);

        worker.on('error', (error) => {
          this._connection.console.error(
            `WORKER execute all error: ${util.inspect(error)}`
          );

          const printableError: PrintableError & { moduleName?: string } =
            formatError(error);
          if (printableError.code === 'MODULE_NOT_FOUND') {
            const str = printableError.message;
            const arr = str.split("'");

            if (arr.length > 2 && arr[0].includes('Cannot find module')) {
              printableError.message = `Cannot find module '${arr[1]}'. Do you want to install it?`;
              printableError.moduleName = arr[1];
            }
          }

          void this._connection.sendNotification(
            ServerCommands.SHOW_ERROR_MESSAGE,
            printableError
          );

          void worker.terminate().then(() => {
            resolve(undefined);
          });
        });

        // Listen for results from the worker thread.
        worker.on('message', (result: ShellExecuteAllResult) => {
          void worker.terminate().then(() => {
            resolve(result);
          });
        });

        // Listen for cancellation request from the language server client.
        token.onCancellationRequested(async () => {
          this._connection.console.log('PLAYGROUND cancellation requested');
          void this._connection.sendNotification(
            ServerCommands.SHOW_INFO_MESSAGE,
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
          await worker.terminate();

          return resolve(undefined);
        });
      } catch (error) {
        this._connection.console.error(
          `MONGOSH execute all error: ${util.inspect(error)}`
        );
        return resolve(undefined);
      }
    });
  }

  // ------ GET DATA FOR COMPLETION ------ //
  _getDatabasesCompletionItems(): void {
    if (!this._extensionPath) {
      this._connection.console.error(
        'MONGOSH get list databases error: extensionPath is undefined'
      );

      return;
    }

    try {
      const worker = new WorkerThreads(
        path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
        {
          workerData: {
            connectionString: this._connectionString,
            connectionOptions: this._connectionOptions,
          },
        }
      );

      this._connection.console.log('MONGOSH get list databases...');
      worker.postMessage(ServerCommands.GET_LIST_DATABASES);

      worker.on('message', (response: [Error, CompletionItem[] | []]) => {
        const [error, result] = response;

        if (error) {
          this._connection.console.error(
            `MONGOSH get list databases error: ${util.inspect(error)}`
          );
        }

        void worker.terminate().then(() => {
          this._connection.console.log(
            `MONGOSH found ${result.length} databases`
          );
          this._updateCurrentSessionDatabases(result);
        });
      });
    } catch (error) {
      this._connection.console.error(
        `MONGOSH get list databases error: ${util.inspect(error)}`
      );
    }
  }

  _getCollectionsCompletionItems(databaseName: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this._extensionPath) {
        this._connection.console.log(
          'MONGOSH get list collections error: extensionPath is undefined'
        );

        return resolve(false);
      }

      try {
        const worker = new WorkerThreads(
          path.resolve(
            this._extensionPath,
            'dist',
            languageServerWorkerFileName
          ),
          {
            workerData: {
              connectionString: this._connectionString,
              connectionOptions: this._connectionOptions,
              databaseName,
            },
          }
        );

        this._connection.console.log('MONGOSH get list collections...');
        worker.postMessage(ServerCommands.GET_LIST_COLLECTIONS);

        worker.on('message', (response: [Error, CollectionItem[] | []]) => {
          const [error, result] = response;

          if (error) {
            this._connection.console.log(
              `MONGOSH get list collections error: ${util.inspect(error)}`
            );
          }

          void worker.terminate().then(() => {
            this._connection.console.log(
              `MONGOSH found ${result.length} collections`
            );
            this._updateCurrentSessionCollections(databaseName, result);

            return resolve(true);
          });
        });
      } catch (error) {
        this._connection.console.log(
          `MONGOSH get list collections error: ${util.inspect(error)}`
        );

        return resolve(false);
      }
    });
  }

  _getFieldsCompletionItems(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this._extensionPath) {
        this._connection.console.log(
          'SCHEMA error: extensionPath is undefined'
        );

        return resolve(false);
      }

      try {
        const namespace = `${databaseName}.${collectionName}`;
        const worker = new WorkerThreads(
          path.resolve(
            this._extensionPath,
            'dist',
            languageServerWorkerFileName
          ),
          {
            workerData: {
              connectionString: this._connectionString,
              connectionOptions: this._connectionOptions,
              databaseName,
              collectionName,
            },
          }
        );

        this._connection.console.log(`SCHEMA for namespace: "${namespace}"`);
        worker.postMessage(ServerCommands.GET_FIELDS_FROM_SCHEMA);

        worker.on('message', (response: [Error, CompletionItem[] | []]) => {
          const [error, result] = response;

          if (error) {
            this._connection.console.log(
              `SCHEMA error: ${util.inspect(error)}`
            );
          }

          void worker.terminate().then(() => {
            this._connection.console.log(
              `SCHEMA found ${result.length} fields`
            );
            this._updateCurrentSessionFields(namespace, result);

            return resolve(true);
          });
        });
      } catch (error) {
        this._connection.console.log(`SCHEMA error: ${util.inspect(error)}`);

        return resolve(false);
      }
    });
  }

  // Get shell API symbols/methods completion from mongosh.
  _getShellCompletionItems(): ShellCompletionItem {
    const shellSymbols = {};

    Object.keys(signatures).map((symbol) => {
      shellSymbols[symbol] = Object.keys(
        signatures[symbol].attributes || {}
      ).map((item) => {
        const documentation =
          translator.translate(
            `shell-api.classes.${symbol}.help.attributes.${item}.description`
          ) || '';
        const link =
          translator.translate(
            `shell-api.classes.${symbol}.help.attributes.${item}.link`
          ) || '';
        const detail =
          translator.translate(
            `shell-api.classes.${symbol}.help.attributes.${item}.example`
          ) || '';

        const markdownDocumentation: MarkupContent = {
          kind: MarkupKind.Markdown,
          value: link
            ? `${documentation}\n\n[Read More](${link})`
            : documentation,
        };

        return {
          label: item,
          kind: CompletionItemKind.Method,
          documentation: markdownDocumentation,
          detail,
        };
      });
    });

    return shellSymbols;
  }

  // ------ COMPLETION ------ //
  // Check if a string is a valid property name.
  _isValidPropertyName(str: string): boolean {
    return /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str);
  }

  _prepareCollectionsItems(
    textFromEditor: string,
    collections: Array<CollectionItem>,
    position: { line: number; character: number }
  ): CompletionItem[] {
    if (!collections) {
      return [];
    }

    this._connection.console.log(`collections: ${util.inspect(collections)}`);

    return collections.map((item) => {
      if (this._isValidPropertyName(item.name)) {
        return {
          label: item.name,
          kind: CompletionItemKind.Folder,
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
          filterText.slice(position.character, filterText.length),
        ].join(''),
        textEdit: {
          range: {
            start: { line: position.line, character: 0 },
            end: {
              line: position.line,
              character: filterText.length,
            },
          },
          // Replace with array-like format
          newText: [
            filterText.slice(0, position.character - 1),
            `['${item.name}']`,
            filterText.slice(position.character, filterText.length),
          ].join(''),
        },
      };
    });
  }

  getExportToLanguageMode(
    params: PlaygroundTextAndSelection
  ): ExportToLanguageMode {
    const state = this._visitor.parseAST(params);

    this._connection.console.log(
      `EXPORT TO LANGUAGE state: ${util.inspect(state)}`
    );

    if (state.isArray) {
      return ExportToLanguageMode.AGGREGATION;
    }

    if (state.isObject) {
      return ExportToLanguageMode.QUERY;
    }

    return ExportToLanguageMode.OTHER;
  }

  getNamespaceForSelection(
    params: PlaygroundTextAndSelection
  ): ExportToLanguageNamespace {
    try {
      const state = this._visitor.parseAST(params);
      return {
        databaseName: state.databaseName,
        collectionName: state.collectionName,
      };
    } catch (error) {
      this._connection.console.error(
        `Get namespace for selection error: ${util.inspect(error)}`
      );
      return { databaseName: null, collectionName: null };
    }
  }

  // eslint-disable-next-line complexity
  async provideCompletionItems(
    textFromEditor: string,
    position: { line: number; character: number }
  ): Promise<CompletionItem[]> {
    this._connection.console.log(
      `LS text from editor: ${util.inspect(textFromEditor)}`
    );
    this._connection.console.log(
      `LS current symbol position: ${util.inspect(position)}`
    );

    const state = this._visitor.parseASTWithPlaceholder(
      textFromEditor,
      position
    );

    this._connection.console.log(
      `VISITOR completion state: ${util.inspect(state)}`
    );

    if (
      this.connectionString &&
      state.databaseName &&
      !this._cachedCollections[state.databaseName]
    ) {
      await this._getCollectionsCompletionItems(state.databaseName);
    }

    if (this.connectionString && state.databaseName && state.collectionName) {
      const namespace = `${state.databaseName}.${state.collectionName}`;

      if (!this._cachedFields[namespace]) {
        await this._getFieldsCompletionItems(
          state.databaseName,
          state.collectionName
        );
      }

      if (state.isObjectKey) {
        this._connection.console.log('VISITOR found field names completion');

        return this._cachedFields[namespace] as CompletionItem[];
      }
    }

    if (state.isShellMethod) {
      this._connection.console.log(
        'VISITOR found shell collection methods completion'
      );

      return this._cachedShellSymbols.Collection;
    }

    if (state.isAggregationCursor) {
      this._connection.console.log(
        'VISITOR found shell aggregation cursor methods completion'
      );

      return this._cachedShellSymbols.AggregationCursor;
    }

    if (state.isFindCursor) {
      this._connection.console.log(
        'VISITOR found shell cursor methods completion'
      );

      return this._cachedShellSymbols.Cursor;
    }

    if (state.isDbCallExpression) {
      let dbCompletions: CompletionItem[] = [
        ...this._cachedShellSymbols.Database,
      ];

      if (state.databaseName) {
        this._connection.console.log(
          'VISITOR found shell db methods and collection names completion'
        );

        const collectionCompletions = this._prepareCollectionsItems(
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

      return dbCompletions;
    }

    if (state.isCollectionName && state.databaseName) {
      this._connection.console.log('VISITOR found collection names completion');

      const collectionCompletions = this._prepareCollectionsItems(
        textFromEditor,
        this._cachedCollections[state.databaseName],
        position
      );

      return collectionCompletions;
    }

    if (state.isUseCallExpression) {
      this._connection.console.log('VISITOR found database names completion');

      return this._cachedDatabases;
    }

    this._connection.console.log('VISITOR no completions');

    return [];
  }

  // ------ CURRENT SESSION ------ //
  _clearCurrentSessionFields(): void {
    this._cachedFields = {};
  }

  _updateCurrentSessionFields(
    namespace: string,
    fields: CompletionItem[]
  ): void {
    if (namespace) {
      this._cachedFields[namespace] = fields ? fields : [];
    }
  }

  _clearCurrentSessionDatabases(): void {
    this._cachedDatabases = [];
  }

  _updateCurrentSessionDatabases(databases: CompletionItem[]): void {
    this._cachedDatabases = databases ? databases : [];
  }

  _clearCurrentSessionCollections(): void {
    this._cachedCollections = {};
  }

  _updateCurrentSessionCollections(
    database: string,
    collections: CollectionItem[]
  ): void {
    if (database) {
      this._cachedCollections[database] = collections ? collections : [];
    }
  }

  _clearCurrentSessionConnection(): void {
    this._connectionString = undefined;
    this._connectionOptions = undefined;
  }
}
