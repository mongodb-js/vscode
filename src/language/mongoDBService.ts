import * as util from 'util';
import {
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  DiagnosticSeverity,
  Range,
  Position,
} from 'vscode-languageserver/node';
import type {
  CancellationToken,
  Connection,
  CompletionItem,
  MarkupContent,
  Diagnostic,
} from 'vscode-languageserver/node';
import { CliServiceProvider } from '@mongosh/service-provider-node-driver';
import type { Document } from '@mongosh/service-provider-core';
import { getFilteredCompletions } from '@mongodb-js/mongodb-constants';
import parseSchema from 'mongodb-schema';
import path from 'path';
import { signatures } from '@mongosh/shell-api';
import translator from '@mongosh/i18n';
import { isAtlasStream } from 'mongodb-build-info';
import { Worker as WorkerThreads } from 'worker_threads';

import { ExportToLanguageMode } from '../types/playgroundType';
import formatError from '../utils/formatError';
import { ServerCommands } from './serverCommands';
import type {
  ShellEvaluateResult,
  PlaygroundEvaluateParams,
  ExportToLanguageNamespace,
  PlaygroundTextAndSelection,
  MongoClientOptions,
} from '../types/playgroundType';
import type { ClearCompletionsCache } from '../types/completionsCache';
import { Visitor } from './visitor';
import type { CompletionState, NamespaceState } from './visitor';
import LINKS from '../utils/links';

import DIAGNOSTIC_CODES from './diagnosticCodes';
import { getDBFromConnectionString } from '../utils/connection-string-db';

const PROJECT = '$project';

const GROUP = '$group';

const MATCH = '$match';

const SET_WINDOW_FIELDS = '$setWindowFields';

export const languageServerWorkerFileName = 'languageServerWorker.js';

interface ServiceProviderParams {
  connectionId: string | null;
  connectionString?: string;
  connectionOptions?: MongoClientOptions;
}

export default class MongoDBService {
  _extensionPath?: string; // The absolute file path of the directory containing the extension.
  _connection: Connection;
  _currentConnectionId: string | null = null;
  _currentConnectionString?: string;
  _currentConnectionOptions?: MongoClientOptions;

  _databaseCompletionItems: CompletionItem[] = [];
  _streamProcessorCompletionItems: CompletionItem[] = [];
  _shellSymbolCompletionItems: { [symbol: string]: CompletionItem[] } = {};
  _globalSymbolCompletionItems: CompletionItem[] = [];
  _collections: { [database: string]: string[] } = {};
  _fields: { [namespace: string]: string[] } = {};

  _visitor: Visitor;
  _serviceProvider?: CliServiceProvider;

  constructor(connection: Connection) {
    connection.console.log('MongoDBService initializing...');

    this._connection = connection;
    this._visitor = new Visitor();

    this._cacheShellSymbolCompletionItems();
    this._cacheGlobalSymbolCompletionItems();
  }

  /**
   * The connectionString used by LS to connect to MongoDB.
   */
  get connectionString(): string | undefined {
    return this._currentConnectionString;
  }

  /**
   * The connectionOptions used by LS to connect to MongoDB.
   */
  get connectionOptions(): MongoClientOptions | undefined {
    return this._currentConnectionOptions;
  }

  initialize({
    extensionPath,
    connectionId,
    connectionString,
    connectionOptions,
  }): void {
    this._extensionPath = extensionPath;
    this._currentConnectionId = connectionId;
    this._currentConnectionString = connectionString;
    this._currentConnectionOptions = connectionOptions;
    this._connection.console.log(
      `MongoDBService initialized ${JSON.stringify({
        extensionPath,
        connectionId,
        hasConnectionString: !!connectionString,
        hasConnectionOptions: !!connectionOptions,
      })}`
    );
  }

  /**
   * Change CliServiceProvider active connection.
   */
  async activeConnectionChanged({
    connectionId,
    connectionString,
    connectionOptions,
  }: ServiceProviderParams): Promise<{
    connectionId: string | null;
    successfullyConnected: boolean;
    connectionErrorMessage?: string;
  }> {
    this._connection.console.log(
      `Changing CliServiceProvider active connection... ${JSON.stringify({
        currentConnectionId: this._currentConnectionId,
        newConnectionId: connectionId,
        hasConnectionString: !!connectionString,
        hasConnectionOptions: !!connectionOptions,
      })}`
    );

    // If already connected close the previous connection.
    if (
      this._currentConnectionId &&
      this._currentConnectionId !== connectionId
    ) {
      this.clearCachedCompletions({
        databases: true,
        collections: true,
        fields: true,
        streamProcessors: true,
      });
      await this._closeCurrentConnection();
    }

    this._currentConnectionId = connectionId;
    this._currentConnectionString = connectionString;
    this._currentConnectionOptions = connectionOptions;

    if (connectionId && (!connectionString || !connectionOptions)) {
      this._connection.console.error(
        'Failed to change CliServiceProvider active connection: connectionString and connectionOptions are required'
      );
      return {
        connectionId,
        successfullyConnected: false,
        connectionErrorMessage:
          'connectionString and connectionOptions are required',
      };
    }

    if (connectionString && connectionOptions) {
      this._serviceProvider = await CliServiceProvider.connect(
        connectionString,
        connectionOptions
      );
    }

    if (isAtlasStream(connectionString || '')) {
      await this._getAndCacheStreamProcessors();
    } else {
      await this._getAndCacheDatabases();
    }

    this._connection.console.log(
      `CliServiceProvider active connection has changed: { connectionId: ${connectionId} }`
    );
    return {
      successfullyConnected: true,
      connectionId,
    };
  }

  async _getAndCacheDatabases(): Promise<void> {
    try {
      // Get database names for the current connection.
      const databases = await this._getDatabases();
      // Create and cache database completion items.
      this._cacheDatabaseCompletionItems(databases);
    } catch (error) {
      this._connection.console.error(
        `LS get databases error: ${util.inspect(error)}`
      );
    }
  }

  async _getAndCacheStreamProcessors(): Promise<void> {
    try {
      const processors = await this._getStreamProcessors();
      this._cacheStreamProcessorCompletionItems(processors);
    } catch (error) {
      this._connection.console.error(
        `LS get stream processors error: ${util.inspect(error)}`
      );
    }
  }

  /**
   * Evaluate code from a playground.
   */
  async evaluate(
    params: PlaygroundEvaluateParams,
    token: CancellationToken
  ): Promise<ShellEvaluateResult> {
    this.clearCachedFields();

    return new Promise((resolve) => {
      if (this._currentConnectionId !== params.connectionId) {
        void this._connection.sendNotification(
          ServerCommands.SHOW_ERROR_MESSAGE,
          "The playground's active connection does not match the extension's active connection. Please reconnect and try again."
        );
        return resolve(null);
      }

      if (!this._extensionPath) {
        this._connection.console.error(
          'LS evaluate: extensionPath is undefined'
        );
        return resolve(null);
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

        worker?.on('message', ({ name, payload }) => {
          if (name === ServerCommands.SHOW_CONSOLE_OUTPUT) {
            void this._connection.sendNotification(name, payload);
          }

          if (name === ServerCommands.CODE_EXECUTION_RESULT) {
            const { error, data } = payload as {
              data: ShellEvaluateResult | null;
              error?: any;
            };
            if (error) {
              this._connection.console.error(
                `WORKER error: ${util.inspect(error)}`
              );
              void this._connection.sendNotification(
                ServerCommands.SHOW_ERROR_MESSAGE,
                formatError(error).message
              );
            }
            void worker.terminate().then(() => {
              resolve(data);
            });
          }
        });

        worker.postMessage({
          name: ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND,
          data: {
            codeToEvaluate: params.codeToEvaluate,
            filePath: params.filePath,
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
          return resolve(null);
        });
      } catch (error) {
        this._connection.console.error(
          `LS evaluate error: ${util.inspect(error)}`
        );
        return resolve(null);
      }
    });
  }

  /**
   * Get stream processors names for the current connection.
   */
  async _getStreamProcessors(): Promise<Document[]> {
    if (this._serviceProvider) {
      try {
        const cmd = { listStreamProcessors: 1 };
        const result = await this._serviceProvider.runCommand('admin', cmd);
        return result.streamProcessors ?? [];
      } catch (error) {
        this._connection.console.error(
          `LS get stream processors error: ${error}`
        );
      }
    }
    return [];
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
      result = documents.databases ?? [];
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
        .find(
          databaseName,
          collectionName,
          {},
          // TODO: figure out if we need parseSchema for one field at all.
          // For one document we can simply get deep object keys,
          // or we could analyze the schema for at least 5-10 documents.
          // The current behaviour came from Compass when we do the same:
          // https://github.com/mongodb-js/compass/blob/main/packages/compass-field-store/src/stores/store.js#L193
          { limit: 1 }
        )
        .toArray();

      const schema = await parseSchema(documents);
      result = schema?.fields ? schema.fields.map((item) => item.name) : [];
    } catch (error) {
      this._connection.console.error(`LS get schema fields error: ${error}`);
    }

    return result;
  }

  /**
   * Return 'db', 'sp' and 'use' completion items.
   */
  _cacheGlobalSymbolCompletionItems(): void {
    this._globalSymbolCompletionItems = [
      {
        label: 'db',
        kind: CompletionItemKind.Method,
        preselect: true,
      },
      {
        label: 'sp',
        kind: CompletionItemKind.Method,
        preselect: true,
      },
      {
        label: 'use',
        kind: CompletionItemKind.Function,
        documentation: 'Switch current database.',
        detail: 'use(<databaseName>)',
        preselect: true,
      },
    ];
  }

  /**
   * Create and cache Shell symbols completion items.
   */
  _cacheShellSymbolCompletionItems(): void {
    const shellSymbolCompletionItems = {};

    Object.keys(signatures).map((symbol) => {
      shellSymbolCompletionItems[symbol] = Object.keys(
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

    this._shellSymbolCompletionItems = shellSymbolCompletionItems;
  }

  /**
   * Check if a string is a valid property name.
   */
  _isValidPropertyName(str: string): boolean {
    return /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str);
  }

  /**
   * @param state The state returned from Visitor.
   * @returns The state with the default connected database, if available, if
   * and only if the state returned from visitor does not already mention a
   * database
   */
  withDefaultDatabase<T extends NamespaceState | CompletionState>(state: T): T {
    const defaultDB = this.connectionString
      ? getDBFromConnectionString(this.connectionString)
      : null;
    if (state.databaseName === null && defaultDB !== null) {
      return {
        ...state,
        databaseName: defaultDB,
      };
    }
    return state;
  }

  /**
   * Parse code from a playground to identify
   * a context in which export to language action is being called.
   */
  getExportToLanguageMode(
    params: PlaygroundTextAndSelection
  ): ExportToLanguageMode {
    const state = this._visitor.parseASTForExportToLanguage(params);

    if (state.isArraySelection) {
      return ExportToLanguageMode.AGGREGATION;
    }

    if (state.isObjectSelection) {
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
      const state = this.withDefaultDatabase(
        this._visitor.parseASTForNamespace(params)
      );
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

  _getAggregationDocumentation({
    operator,
    description,
  }: {
    operator: string;
    description?: string;
  }): {
    kind: typeof MarkupKind.Markdown;
    value: string;
  } {
    const title = operator.replace(/[$]/g, '');
    const link = LINKS.aggregationDocs(title);
    return {
      kind: MarkupKind.Markdown,
      value: description
        ? `${description}\n\n[Read More](${link})`
        : `[Documentation](${link})`,
    };
  }

  _getBsonDocumentation({
    bsonType,
    description,
  }: {
    bsonType: string;
    description?: string;
  }): {
    kind: typeof MarkupKind.Markdown;
    value: string;
  } {
    const link = LINKS.bsonDocs(bsonType);
    return {
      kind: MarkupKind.Markdown,
      value: description
        ? `${description}\n\n[Read More](${link})`
        : `[Documentation](${link})`,
    };
  }

  _getSystemVariableDocumentation({
    variable,
    description,
  }: {
    variable: string;
    description?: string;
  }): {
    kind: typeof MarkupKind.Markdown;
    value: string;
  } {
    const title = variable.replace(/[$]/g, '');
    const link = LINKS.systemVariableDocs(title);
    return {
      kind: MarkupKind.Markdown,
      value: description
        ? `${description}\n\n[Read More](${link})`
        : `[Documentation](${link})`,
    };
  }

  /**
   * Get and cache collection and field names based on the namespace.
   */
  async _getCompletionValuesAndUpdateCache(
    currentDatabaseName: string | null,
    currentCollectionName: string | null
  ): Promise<void> {
    if (currentDatabaseName && !this._collections[currentDatabaseName]) {
      // Get collection names for the current database.
      const collections = await this._getCollections(currentDatabaseName);

      // Create and cache collection completion items.
      this._cacheCollections(currentDatabaseName, collections);
    }

    if (currentDatabaseName && currentCollectionName) {
      const namespace = `${currentDatabaseName}.${currentCollectionName}`;

      if (!this._fields[namespace]) {
        // Get field names for the current namespace.
        const schemaFields = await this._getSchemaFields(
          currentDatabaseName,
          currentCollectionName
        );

        // Create and cache field completion items.
        this.cacheFields(namespace, schemaFields);
      }
    }
  }

  /**
   * If the current node is 'db.collection.aggregate([{<trigger>}])'.
   */
  _provideStageCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isStage) {
      this._connection.console.log('VISITOR found stage operator completions');

      return getFilteredCompletions({ meta: ['stage'] }).map((item) => {
        let snippet = item.value;

        if (item.snippet) {
          const escapedOp = item.value.replace('$', '\\$');
          snippet = `${escapedOp}: ${item.snippet}`;
        }

        return {
          label: item.value,
          kind: CompletionItemKind.Keyword,
          insertText: snippet,
          insertTextFormat: InsertTextFormat.Snippet,
          documentation: this._getAggregationDocumentation({
            operator: item.value,
            description: item.description,
          }),
          preselect: true,
        };
      });
    }
  }

  /**
   * If the current node is 'db.collection.aggregate([{ $match: {<trigger>} }])'
   * or 'db.collection.find({<trigger>})'
   * we check a playground text before the current cursor position.
   * If we found 'use("db")' or 'db.collection' we also suggest field names.
   */
  _provideQueryOperatorCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (
      state.stageOperator === MATCH ||
      (state.stageOperator === null && state.isObjectKey)
    ) {
      const fields =
        this._fields[`${state.databaseName}.${state.collectionName}`] || [];
      const message = [
        'VISITOR found',
        'query operator',
        fields.length ? 'and fields' : '',
        'completions',
      ];
      this._connection.console.log(message.join(' '));

      return getFilteredCompletions({
        fields,
        meta: ['query', 'field:identifier'],
      }).map((item) => {
        return {
          label: item.value,
          kind:
            item.meta === 'field:identifier'
              ? CompletionItemKind.Field
              : CompletionItemKind.Keyword,
          documentation: this._getAggregationDocumentation({
            operator: item.value,
            description: item.description,
          }),
          preselect: true,
        };
      });
    }
  }

  /**
   * If the current node is 'db.collection.aggregate([{ $<stage>: {<trigger>} }])'
   * we check a playground text before the current cursor position.
   * If we found 'use("db")' or 'db.collection' we also suggest field names.
   */
  _provideAggregationOperatorCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.stageOperator) {
      const fields =
        this._fields[`${state.databaseName}.${state.collectionName}`] || [];
      const message = [
        'VISITOR found',
        'aggregation operator',
        fields.length ? 'and fields' : '',
        'completions',
      ];
      this._connection.console.log(message.join(' '));

      return getFilteredCompletions({
        fields,
        meta: [
          'expr:*',
          'conv',
          ...([PROJECT, GROUP].includes(state.stageOperator ?? '')
            ? ([
                'accumulator',
                'accumulator:bottom-n',
                'accumulator:top-n',
              ] as const)
            : []),
          ...(state.stageOperator === SET_WINDOW_FIELDS
            ? (['accumulator:window'] as const)
            : []),
        ],
      }).map((item) => {
        return {
          label: item.value,
          kind:
            item.meta === 'field:identifier'
              ? CompletionItemKind.Field
              : CompletionItemKind.Keyword,
          documentation: this._getAggregationDocumentation({
            operator: item.value,
            description: item.description,
          }),
          preselect: true,
        };
      });
    }
  }

  /**
   * If the current node is 'db.collection.find({ _id: <trigger>});'.
   */
  _provideIdentifierObjectValueCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isIdentifierObjectValue) {
      this._connection.console.log('VISITOR found bson completions');
      return getFilteredCompletions({ meta: ['bson'] }).map((item) => {
        let snippet = item.value;

        if (item.snippet) {
          const escapedOp = item.value.replace('$', '\\$');
          snippet = `${escapedOp}: ${item.snippet}`;
        }

        return {
          label: item.value,
          kind: CompletionItemKind.Constructor,
          insertText: snippet,
          insertTextFormat: InsertTextFormat.Snippet,
          documentation: this._getBsonDocumentation({
            bsonType: item.value,
            description: item.description,
          }),
          preselect: true,
        };
      });
    }
  }

  /**
   * If the current node is 'db.collection.find({ field: "<trigger>" });'.
   */
  _provideTextObjectValueCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isTextObjectValue) {
      const fields =
        this._fields[`${state.databaseName}.${state.collectionName}`];
      this._connection.console.log('VISITOR found field reference completions');

      return getFilteredCompletions({
        fields,
        meta: ['field:reference', 'variable:*'],
      }).map((item) => {
        return {
          label: item.value,
          kind:
            item.meta === 'field:reference'
              ? CompletionItemKind.Reference
              : CompletionItemKind.Variable,
          documentation:
            item.meta === 'variable:system'
              ? this._getSystemVariableDocumentation({
                  variable: item.value,
                  description: item.description,
                })
              : item.description,
          preselect: true,
        };
      });
    }
  }

  /**
   * If the current node is 'db.collection.<trigger>' or 'db["test"].<trigger>'.
   */
  _provideCollectionSymbolCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isCollectionSymbol) {
      this._connection.console.log(
        'VISITOR found collection symbol completions'
      );
      return this._shellSymbolCompletionItems.Collection;
    }
  }

  /**
   * If the current node is 'sp.processor.<trigger>' or 'sp["processor"].<trigger>'.
   */
  _provideStreamProcessorSymbolCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isStreamProcessorSymbol) {
      this._connection.console.log(
        'VISITOR found stream processor symbol completions'
      );
      return this._shellSymbolCompletionItems.StreamProcessor;
    }
  }

  /**
   * If the current node is 'db.collection.find().<trigger>'.
   */
  _provideFindCursorCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isFindCursor) {
      this._connection.console.log('VISITOR found find cursor completions');
      return this._shellSymbolCompletionItems.Cursor;
    }
  }

  /**
   * If the current node is 'db.collection.aggregate().<trigger>'.
   */
  _provideAggregationCursorCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isAggregationCursor) {
      this._connection.console.log(
        'VISITOR found aggregation cursor completions'
      );
      return this._shellSymbolCompletionItems.AggregationCursor;
    }
  }

  /**
   * If the current node is 'db' or 'use'.
   */
  _provideGlobalSymbolCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isGlobalSymbol) {
      this._connection.console.log('VISITOR found global symbol completions');
      return this._globalSymbolCompletionItems;
    }
  }

  /**
   * Convert cached collection names into completion items.
   * We do not cache completion items as we do for other entities,
   * because some of the collection names have special characters
   * and must be edited to the bracket notation based on the current line content.
   */
  _getCollectionCompletionItems({
    databaseName,
    currentLineText,
    position,
  }: {
    databaseName: string;
    currentLineText: string;
    position: { line: number; character: number };
  }): CompletionItem[] {
    return this._collections[databaseName].map((collectionName) => {
      if (this._isValidPropertyName(collectionName)) {
        return {
          label: collectionName,
          kind: CompletionItemKind.Folder,
          preselect: true,
        };
      }

      return {
        label: collectionName,
        kind: CompletionItemKind.Folder,
        // The current line text, e.g. `{ db. } // Comment`.
        filterText: currentLineText,
        textEdit: {
          range: {
            start: { line: position.line, character: 0 },
            end: {
              line: position.line,
              character: currentLineText.length,
            },
          },
          // The completion item with the collection name converted into the bracket notation.
          newText: [
            currentLineText.slice(0, position.character - 1),
            `['${collectionName}']`,
            currentLineText.slice(position.character, currentLineText.length),
          ].join(''),
        },
        preselect: true,
      };
    });
  }

  /**
   * If the current node is 'db.<trigger>'.
   */
  _provideDbSymbolCompletionItems(
    state: CompletionState,
    currentLineText: string,
    position: { line: number; character: number }
  ): CompletionItem[] | undefined {
    // If we found 'use("db")' and the current node is 'db.<trigger>'.
    if (state.isDbSymbol && state.databaseName) {
      this._connection.console.log(
        'VISITOR found db symbol and collection name completions'
      );

      return [
        ...this._shellSymbolCompletionItems.Database,
        ...this._getCollectionCompletionItems({
          databaseName: state.databaseName,
          currentLineText,
          position,
        }),
      ];
    }

    // If the current node is 'db.<trigger>'.
    if (state.isDbSymbol) {
      this._connection.console.log('VISITOR found db symbol completions');
      return this._shellSymbolCompletionItems.Database;
    }
  }

  /**
   * If the current node is 'sp.<trigger>'.
   */
  _provideSpSymbolCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isSpSymbol) {
      if (state.isStreamProcessorName) {
        this._connection.console.log(
          'VISITOR found sp symbol and stream processor name completions'
        );
        return this._shellSymbolCompletionItems.Streams.concat(
          this._streamProcessorCompletionItems
        );
      }

      this._connection.console.log('VISITOR found sp symbol completions');
      return this._shellSymbolCompletionItems.Streams;
    }
  }

  /**
   * If the current node is 'sp.get(<trigger>)'.
   */
  _provideStreamProcessorNameCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isStreamProcessorName) {
      this._connection.console.log(
        'VISITOR found stream processor name completions'
      );
      return this._streamProcessorCompletionItems;
    }
  }

  /**
   * If the current node can be used as a collection name
   * e.g. 'db.<trigger>.find()' or 'let a = db.<trigger>'.
   */
  _provideCollectionNameCompletionItems(
    state: CompletionState,
    currentLineText: string,
    position: { line: number; character: number }
  ): CompletionItem[] | undefined {
    if (state.isCollectionName && state.databaseName) {
      this._connection.console.log('VISITOR found collection name completions');
      return this._getCollectionCompletionItems({
        databaseName: state.databaseName,
        currentLineText,
        position,
      });
    }
  }

  /**
   * If the current node is 'use("<trigger>"")'.
   */
  _provideDbNameCompletionItems(
    state: CompletionState
  ): CompletionItem[] | undefined {
    if (state.isUseCallExpression) {
      this._connection.console.log('VISITOR found database names completion');
      return this._databaseCompletionItems;
    }
  }

  /**
   * Parse code from a playground to identify
   * where the cursor is and suggests only suitable completion items.
   */
  async provideCompletionItems({
    document,
    position,
  }: {
    document?: Document;
    position: { line: number; character: number };
  }): Promise<CompletionItem[]> {
    this._connection.console.log(
      `Provide completion items for a position: ${util.inspect(position)}`
    );

    const state = this.withDefaultDatabase(
      this._visitor.parseASTForCompletion(document?.getText(), position)
    );
    this._connection.console.log(
      `VISITOR completion state: ${util.inspect(state)}`
    );

    await this._getCompletionValuesAndUpdateCache(
      state.databaseName,
      state.collectionName
    );

    const currentLineText = document?.getText(
      Range.create(
        Position.create(position.line, 0),
        Position.create(position.line + 1, 0)
      )
    );

    const completionOptions = [
      this._provideStageCompletionItems.bind(this, state),
      this._provideQueryOperatorCompletionItems.bind(this, state),
      this._provideAggregationOperatorCompletionItems.bind(this, state),
      this._provideIdentifierObjectValueCompletionItems.bind(this, state),
      this._provideTextObjectValueCompletionItems.bind(this, state),
      this._provideCollectionSymbolCompletionItems.bind(this, state),
      this._provideStreamProcessorSymbolCompletionItems.bind(this, state),
      this._provideFindCursorCompletionItems.bind(this, state),
      this._provideAggregationCursorCompletionItems.bind(this, state),
      this._provideGlobalSymbolCompletionItems.bind(this, state),
      this._provideDbSymbolCompletionItems.bind(
        this,
        state,
        currentLineText,
        position
      ),
      this._provideSpSymbolCompletionItems.bind(this, state),
      this._provideCollectionNameCompletionItems.bind(
        this,
        state,
        currentLineText,
        position
      ),
      this._provideDbNameCompletionItems.bind(this, state),
      this._provideStreamProcessorNameCompletionItems.bind(this, state),
    ];

    for (const func of completionOptions) {
      const result = func();
      if (result !== null && result !== undefined) {
        return result;
      }
    }

    this._connection.console.log('VISITOR found no mongodb completion');
    return [];
  }

  // Highlight the usage of commands that only works inside interactive session.
  provideDiagnostics(textFromEditor: string): Diagnostic[] {
    const lines = textFromEditor.split(/\r?\n/g);
    const diagnostics: Diagnostic[] = [];
    const invalidInteractiveSyntaxes = [
      { issue: 'use', fix: "use('VALUE_TO_REPLACE')", default: 'database' },
      { issue: 'show databases', fix: 'db.getMongo().getDBs()' },
      { issue: 'show dbs', fix: 'db.getMongo().getDBs()' },
      { issue: 'show collections', fix: 'db.getCollectionNames()' },
      { issue: 'show tables', fix: 'db.getCollectionNames()' },
      {
        issue: 'show profile',
        fix: "db.getCollection('system.profile').find()",
      },
      { issue: 'show users', fix: 'db.getUsers()' },
      { issue: 'show roles', fix: 'db.getRoles({ showBuiltinRoles: true })' },
      { issue: 'show logs', fix: "db.adminCommand({ getLog: '*' })" },
      {
        issue: 'show log',
        fix: "db.adminCommand({ getLog: 'VALUE_TO_REPLACE' })",
        default: 'global',
      },
    ];

    for (const [i, line] of lines.entries()) {
      for (const item of invalidInteractiveSyntaxes) {
        const issue = item.issue; // E.g. 'use'.
        const startCharacter = line.indexOf(issue); // The start index where the issue was found in the string.

        // In case of `show logs` exclude `show log` diagnostic issue.
        if (
          issue === 'show log' &&
          line.substring(startCharacter).startsWith('show logs')
        ) {
          continue;
        }

        // In case of `user.authenticate()` do not rise a diagnostic issue.
        if (
          issue === 'use' &&
          !line.substring(startCharacter).startsWith('use ')
        ) {
          continue;
        }

        if (!line.trim().startsWith(issue)) {
          continue;
        }

        let endCharacter = startCharacter + issue.length;
        let valueToReplaceWith = item.default;
        let fix = item.fix;

        // If there is a default value, it should be used
        // instead of VALUE_TO_REPLACE placeholder of the `fix` string.
        if (valueToReplaceWith) {
          const words = line.substring(startCharacter).split(' ');

          // The index of the value for `use <value>` and `show log <value>`.
          const valueIndex = issue.split(' ').length;

          if (words[valueIndex]) {
            // The `use ('database')`, `use []`, `use .` are valid JS strings.
            if (
              ['(', '[', '.'].some((word) => words[valueIndex].startsWith(word))
            ) {
              continue;
            }

            // Get the value from a string by removing quotes if any.
            valueToReplaceWith = words[valueIndex].replace(/['";]+/g, '');

            // Add the replacement value and the space between to the total command length.
            endCharacter += words[valueIndex].length + 1;
          }

          fix = fix.replace('VALUE_TO_REPLACE', valueToReplaceWith);
        }

        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: i, character: startCharacter },
            end: { line: i, character: endCharacter },
          },
          message: `Did you mean \`${fix}\`?`,
          data: { fix },
        });
      }
    }

    return diagnostics;
  }

  /**
   * Convert schema field names to Completion Items and cache them.
   */
  cacheFields(namespace: string, fields: string[]): void {
    if (namespace) {
      this._fields[namespace] = fields ? fields : [];
    }
  }

  /**
   * Convert database names to Completion Items and cache them.
   */
  _cacheDatabaseCompletionItems(databases: Document[]): void {
    this._databaseCompletionItems = databases.map((db) => ({
      label: db.name,
      kind: CompletionItemKind.Field,
      preselect: true,
    }));
  }

  /**
   * Cache collection names.
   */
  _cacheCollections(database: string, collections: Document[]): void {
    this._collections[database] = collections.map((item) => item.name);
  }

  _cacheStreamProcessorCompletionItems(processors: Document[]): void {
    this._streamProcessorCompletionItems = processors.map(({ name }) => ({
      kind: CompletionItemKind.Folder,
      preselect: true,
      label: name,
    }));
  }

  clearCachedStreamProcessors(): void {
    this._streamProcessorCompletionItems = [];
  }

  clearCachedFields(): void {
    this._fields = {};
  }

  clearCachedDatabases(): void {
    this._databaseCompletionItems = [];
  }

  clearCachedCollections(): void {
    this._collections = {};
  }

  async _closeCurrentConnection(): Promise<void> {
    if (this._serviceProvider) {
      this._connection.console.log(
        `Disconnecting from a previous connection... { connectionId: ${this._currentConnectionId} }`
      );
      const serviceProvider = this._serviceProvider;
      this._serviceProvider = undefined;
      await serviceProvider.close(true);
    }
  }

  clearCachedCompletions(clear: ClearCompletionsCache): void {
    if (clear.fields) {
      this.clearCachedFields();
    }
    if (clear.databases) {
      this.clearCachedDatabases();
    }
    if (clear.collections) {
      this.clearCachedCollections();
    }
    if (clear.streamProcessors) {
      this.clearCachedStreamProcessors();
    }
  }
}
