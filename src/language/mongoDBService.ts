import * as util from 'util';
import { CompletionItemKind, MarkupKind } from 'vscode-languageserver/node';
import type {
  CancellationToken,
  Connection,
  CompletionItem,
  MarkupContent,
} from 'vscode-languageserver/node';
import path from 'path';
import { signatures } from '@mongosh/shell-api';
import translator from '@mongosh/i18n';
import { Worker as WorkerThreads } from 'worker_threads';
import type { Document } from '@mongosh/service-provider-core';
import { CliServiceProvider } from '@mongosh/service-provider-server';
import parseSchema from 'mongodb-schema';

import formatError from '../utils/formatError';
import { ServerCommands } from './serverCommands';
import { ExportToLanguageMode } from '../types/playgroundType';
import type {
  ShellEvaluateResult,
  PlaygroundEvaluateParams,
  ExportToLanguageNamespace,
  PlaygroundTextAndSelection,
} from '../types/playgroundType';
import { Visitor } from './visitor';

export const languageServerWorkerFileName = 'languageServerWorker.js';

type MongoClientOptions = NonNullable<
  Parameters<typeof CliServiceProvider['connect']>[1]
>;

interface ServiceProviderParams {
  connectionId: string;
  connectionString: string;
  connectionOptions: MongoClientOptions;
}

export default class MongoDBService {
  _extensionPath?: string;
  _connection: Connection;
  _connectionId?: string;
  _connectionString?: string;
  _connectionOptions?: MongoClientOptions;

  _cachedDatabases: CompletionItem[] = [];
  _cachedFields: { [namespace: string]: CompletionItem[] } = {};
  _cachedCollections: { [database: string]: CompletionItem[] } = {};
  _cachedShellSymbols: { [symbol: string]: CompletionItem[] } = {};

  _visitor: Visitor;
  _serviceProvider?: CliServiceProvider;

  constructor(connection: Connection) {
    this._connection = connection;
    this._visitor = new Visitor(connection.console);

    this._cacheShellSymbolsCompletionItems();
  }

  /**
   * The connectionString used by LS to connect to MongoDB.
   */
  get connectionString(): string | undefined {
    return this._connectionString;
  }

  /**
   * The connectionOptions used by LS to connect to MongoDB.
   */
  get connectionOptions(): MongoClientOptions | undefined {
    return this._connectionOptions;
  }

  /**
   * The absolute file path of the directory containing the extension.
   */
  setExtensionPath(extensionPath: string): void {
    this._extensionPath = extensionPath;
  }

  /**
   * Connect to CliServiceProvider.
   */
  async connectToServiceProvider({
    connectionId,
    connectionString,
    connectionOptions,
  }: ServiceProviderParams): Promise<boolean> {
    // If already connected close the previous connection.
    await this.disconnectFromServiceProvider();

    this._connectionId = connectionId;
    this._connectionString = connectionString;
    this._connectionOptions = connectionOptions;
    this._serviceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );

    try {
      // Get database names for the current connection.
      const databases = await this._getDatabases();

      // Create and cache database completion items.
      this._cacheDatabaseCompletionItems(databases);
      return Promise.resolve(true);
    } catch (error) {
      this._connection.console.error(
        `LS get databases error: ${util.inspect(error)}`
      );
      return Promise.resolve(false);
    }
  }

  /**
   * Disconnect from CliServiceProvider.
   */
  async disconnectFromServiceProvider(): Promise<void> {
    this._clearCachedDatabases();
    this._clearCachedCollections();
    this._clearCachedFields();

    await this._clearCurrentConnection();
  }

  /**
   * Evalauate code from a playground.
   */
  async evalauate(
    params: PlaygroundEvaluateParams,
    token: CancellationToken
  ): Promise<ShellEvaluateResult | undefined> {
    this._clearCachedFields();

    return new Promise((resolve) => {
      if (this._connectionId !== params.connectionId) {
        void this._connection.sendNotification(
          ServerCommands.SHOW_ERROR_MESSAGE,
          "The playground's active connection does not match the extension's active connection. Please reconnect and try again."
        );
        return resolve(undefined);
      }

      if (!this._extensionPath) {
        this._connection.console.error(
          'LS evaluate: extensionPath is undefined'
        );
        return resolve(undefined);
      }

      try {
        // We allow users to run any code in their playgrounds,
        // which includes long-running operations and even infinite loops.
        // Users can open several playgrounds simultaneously.
        // For each open playground we create a new Node.js thread.
        // We use cancelation tokens to handle users' requests to terminate
        // the current evaluation.
        // Each thread is responsible for one playground evaluation and then terminates.
        // By doing this we ensure that the CliServiceProvider connection is up-to-date,
        // and that multiple playground runs do not interfere with each other.
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
          )
        );
        this._connection.console.log(
          `WORKER thread is created on path: ${this._extensionPath}`
        );

        worker?.on('error', (error) => {
          this._connection.console.error(
            `WORKER error: ${util.inspect(error)}`
          );
          void this._connection.sendNotification(
            ServerCommands.SHOW_ERROR_MESSAGE,
            formatError(error).message
          );
          void worker.terminate().then(() => {
            resolve(undefined);
          });
        });

        worker?.on('message', (data) => {
          void worker.terminate().then(() => {
            resolve(data);
          });
        });

        worker.postMessage({
          name: ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND,
          data: {
            codeToEvaluate: params.codeToEvaluate,
            connectionString: this.connectionString,
            connectionOptions: this.connectionOptions,
          },
        });

        // Listen for cancellation request from the language server client.
        token.onCancellationRequested(async () => {
          this._connection.console.log('PLAYGROUND cancellation requested');
          void this._connection.sendNotification(
            ServerCommands.SHOW_INFO_MESSAGE,
            'The running playground operation was canceled.'
          );

          // Stop the worker and all JavaScript execution
          // in the worker thread as soon as possible.
          await worker.terminate();
          return resolve(undefined);
        });
      } catch (error) {
        this._connection.console.error(
          `LS evaluate error: ${util.inspect(error)}`
        );
        return resolve(undefined);
      }
    });
  }

  /**
   * Get database names for the current connection.
   */
  async _getDatabases(): Promise<Document[]> {
    let result: Document[] = [];

    if (!this._serviceProvider) {
      return [];
    }

    try {
      // TODO: There is a mistake in the service provider interface
      // Use `admin` as arguments to get list of dbs
      // and remove it later when `mongosh` will merge a fix.
      const documents = await this._serviceProvider.listDatabases('admin');
      result = documents.databases ? documents.databases : [];
    } catch (error) {
      this._connection.console.error(`LS get databases error: ${error}`);
    }

    return result;
  }

  /**
   * Get collection names for the provided database name.
   */
  async _getCollections(databaseName: string): Promise<Document[]> {
    let result: Document[] = [];

    if (!this._serviceProvider) {
      return [];
    }

    try {
      const documents = await this._serviceProvider.listCollections(
        databaseName
      );
      result = documents ? documents : [];
    } catch (error) {
      this._connection.console.error(`LS get collections error: ${error}`);
    }

    return result;
  }

  /**
   * Get field names for the provided namespace.
   */
  async _getSchemaFields(
    databaseName: string,
    collectionName: string
  ): Promise<string[]> {
    let result: string[] = [];

    if (!this._serviceProvider) {
      return [];
    }

    try {
      const documents = await this._serviceProvider
        .find(databaseName, collectionName, {}, { limit: 1 })
        .toArray();

      if (documents.length) {
        const schema = await parseSchema(documents);
        result = schema?.fields ? schema.fields.map((item) => item.name) : [];
      }
    } catch (error) {
      this._connection.console.error(`LS get schema fields error: ${error}`);
    }

    return result;
  }

  /**
   * Create and cache Shell symbols completion items.
   */
  _cacheShellSymbolsCompletionItems() {
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
          preselect: true,
        };
      });
    });

    this._cachedShellSymbols = shellSymbols;
  }

  /**
   * Check if a string is a valid property name.
   */
  _isValidPropertyName(str: string): boolean {
    return /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str);
  }

  /**
   * Parse code from a playground to identify
   * a context in which export to language action is being called.
   */
  getExportToLanguageMode(
    params: PlaygroundTextAndSelection
  ): ExportToLanguageMode {
    const state = this._visitor.parseAST(params);

    if (state.isArray) {
      return ExportToLanguageMode.AGGREGATION;
    }

    if (state.isObject) {
      return ExportToLanguageMode.QUERY;
    }

    return ExportToLanguageMode.OTHER;
  }

  /**
   * Parse code from a playground to identify
   * a namespace for the export to language action.
   */
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
        `VISITOR namespace for selection error: ${util.inspect(error)}`
      );
      return { databaseName: null, collectionName: null };
    }
  }

  /**
   * Parse code from a playground to identify
   * a namespace for the export to language action.
   */
  // eslint-disable-next-line complexity
  async provideCompletionItems(
    textFromEditor: string,
    position: { line: number; character: number }
  ): Promise<CompletionItem[]> {
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
      // Get collection names for the current database.
      const collections = await this._getCollections(state.databaseName);

      // Create and cache collection completion items.
      this._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        state.databaseName,
        collections
      );
    }

    if (this.connectionString && state.databaseName && state.collectionName) {
      const namespace = `${state.databaseName}.${state.collectionName}`;

      if (!this._cachedFields[namespace]) {
        // Get field names for the current namespace.
        const schemaFields = await this._getSchemaFields(
          state.databaseName,
          state.collectionName
        );

        // Create and cache field completion items.
        this._cacheFieldCompletionItems(namespace, schemaFields);
      }

      if (state.isObjectKey) {
        this._connection.console.log('VISITOR found field names completion');
        return this._cachedFields[namespace];
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
        dbCompletions = dbCompletions.concat(
          this._cachedCollections[state.databaseName]
        );
      } else {
        this._connection.console.log(
          'VISITOR found shell db methods completion'
        );
      }

      return dbCompletions;
    }

    if (state.isCollectionName && state.databaseName) {
      this._connection.console.log('VISITOR found collection names completion');
      return this._cachedCollections[state.databaseName];
    }

    if (state.isUseCallExpression) {
      this._connection.console.log('VISITOR found database names completion');

      return this._cachedDatabases;
    }

    this._connection.console.log('VISITOR no completions');

    return [];
  }

  _cacheFieldCompletionItems(namespace: string, schemaFields: string[]): void {
    if (namespace) {
      const fields = schemaFields.map((field) => ({
        label: field,
        kind: CompletionItemKind.Field,
        preselect: true,
      }));

      this._cachedFields[namespace] = fields ? fields : [];
    }
  }
  _cacheDatabaseCompletionItems(databases: Document[]): void {
    this._cachedDatabases = databases.map((item) => ({
      label: (item as { name: string }).name,
      kind: CompletionItemKind.Field,
      preselect: true,
    }));
  }

  _cacheCollectionCompletionItems(
    textFromEditor: string,
    position: { line: number; character: number },
    database: string,
    collections: Document[]
  ): void {
    this._cachedCollections[database] = collections.map((item) => {
      if (this._isValidPropertyName(item.name)) {
        return {
          label: item.name,
          kind: CompletionItemKind.Folder,
          preselect: true,
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
          preselect: true,
        },
      };
    });
  }

  _clearCachedFields(): void {
    this._cachedFields = {};
  }

  _clearCachedDatabases(): void {
    this._cachedDatabases = [];
  }

  _clearCachedCollections(): void {
    this._cachedCollections = {};
  }

  async _clearCurrentConnection(): Promise<void> {
    this._connectionId = undefined;
    this._connectionString = undefined;
    this._connectionOptions = undefined;

    if (this._serviceProvider) {
      await this._serviceProvider.close(true);
      this._serviceProvider = undefined;
    }
  }
}
